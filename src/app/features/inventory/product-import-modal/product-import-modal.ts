import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Modal } from '../../../shared/modal/modal';
import { ProductsService } from '../../../core/services/products';
import {
  ImportField,
  ImportProductsResult,
  ProductImportPreview,
  ProductImportRow,
} from '../../../core/models/product-import.model';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FIELD_LABELS: Record<ImportField, string> = {
  name: 'Nombre',
  code: 'Código',
  salePrice: 'Precio de venta',
  cost: 'Costo',
  stock: 'Stock',
  minimumStock: 'Stock mínimo',
  category: 'Categoría',
  unit: 'Unidad',
  description: 'Descripción',
};

// Plantilla con ejemplos de rubros distintos: sirve para cualquier inventario.
// "sep=;" hace que Excel en español la abra en columnas.
const TEMPLATE = [
  'sep=;',
  'Nombre;Código;Precio de venta;Costo;Stock;Stock mínimo;Categoría;Unidad;Descripción;Marca;Modelo',
  'Mouse inalámbrico;;95;60;12;3;Computación;Unidad;Mouse USB 2.4 GHz;Logitech;M170',
  'Ron añejo 750 ml;;120;85;24;6;Licores;Unidad;;Abuelo;Añejo',
  'Polera algodón talla M;POL-ALG-M;70;35;30;5;Ropa;Unidad;;;',
].join('\r\n');

type Stage = 'pick' | 'preview' | 'done';

@Component({
  selector: 'app-product-import-modal',
  imports: [Modal, DecimalPipe],
  templateUrl: './product-import-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductImportModal {
  private productsService = inject(ProductsService);

  close = output<void>();
  imported = output<ImportProductsResult>();

  stage = signal<Stage>('pick');
  dragging = signal(false);
  reading = signal(false);
  importing = signal(false);
  errorMessage = signal<string | null>(null);
  fileName = signal('');
  preview = signal<ProductImportPreview | null>(null);
  result = signal<ImportProductsResult | null>(null);
  onlyProblems = signal(false);

  fieldLabel = (field: ImportField) => FIELD_LABELS[field];

  recognized = computed(() => this.preview()?.columns.filter(c => c.field) ?? []);
  asAttributes = computed(() => this.preview()?.columns.filter(c => !c.field) ?? []);
  // "Producto → Nombre, SKU → Código, Precio" (solo se aclara cuando el título difiere).
  recognizedText = computed(() =>
    this.recognized()
      .map(c => {
        const label = FIELD_LABELS[c.field!];
        return c.header.toLowerCase() === label.toLowerCase() ? c.header : `${c.header} → ${label}`;
      })
      .join(', '),
  );
  attributesText = computed(() => this.asAttributes().map(c => c.header).join(', '));

  missingImportant = computed(() => {
    const fields = new Set(this.recognized().map(c => c.field));
    return (['salePrice', 'stock'] as ImportField[]).filter(f => !fields.has(f)).map(f => FIELD_LABELS[f]);
  });

  visibleRows = computed(() => {
    const rows = this.preview()?.rows ?? [];
    return this.onlyProblems() ? rows.filter(r => r.errors.length) : rows;
  });

  attributeText = (row: ProductImportRow) =>
    Object.entries(row.attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');

  downloadTemplate() {
    // BOM: Excel reconoce las tildes.
    const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-productos.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.read(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.read(file);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  private read(file: File) {
    this.errorMessage.set(null);
    if (!/\.(xlsx|csv|txt|xls)$/i.test(file.name)) {
      this.errorMessage.set('Sube un archivo de Excel (.xlsx) o .csv.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.errorMessage.set('El archivo pesa más de 5 MB. Divídelo en dos y súbelos por separado.');
      return;
    }

    this.fileName.set(file.name);
    this.reading.set(true);
    this.productsService.previewImport(file).subscribe({
      next: preview => {
        this.reading.set(false);
        this.preview.set(preview);
        this.onlyProblems.set(false);
        this.stage.set('preview');
      },
      error: (err: HttpErrorResponse) => {
        this.reading.set(false);
        this.errorMessage.set(this.mapError(err, 'No se pudo leer el archivo.'));
      },
    });
  }

  chooseAnother() {
    this.preview.set(null);
    this.errorMessage.set(null);
    this.stage.set('pick');
  }

  confirm() {
    const preview = this.preview();
    if (!preview || preview.validCount === 0) return;

    const items = preview.rows
      .filter(r => r.errors.length === 0)
      .map(r => ({
        rowNumber: r.rowNumber,
        name: r.name,
        code: r.code,
        salePrice: r.salePrice,
        cost: r.cost,
        stock: r.stock,
        minimumStock: r.minimumStock,
        categoryName: r.categoryName,
        unitName: r.unitName,
        description: r.description,
        attributes: r.attributes,
      }));

    this.errorMessage.set(null);
    this.importing.set(true);
    this.productsService.importProducts(items).subscribe({
      next: result => {
        this.importing.set(false);
        this.result.set(result);
        this.stage.set('done');
        this.imported.emit(result);
      },
      error: (err: HttpErrorResponse) => {
        this.importing.set(false);
        this.errorMessage.set(this.mapError(err, 'No se pudo importar. Intenta nuevamente.'));
      },
    });
  }

  private mapError(err: HttpErrorResponse, fallback: string): string {
    return typeof err.error?.error === 'string' ? err.error.error : fallback;
  }
}

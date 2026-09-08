import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Category } from '../../../core/models/category.model';

// Nodo recursivo: se importa a sí mismo para renderizar sus children sin
// límite de profundidad. Solo se usa con GET ?tree=true (ver categories-list).
const INDENT_CLASSES = ['pl-0', 'pl-6', 'pl-12', 'pl-16', 'pl-20', 'pl-24'];

@Component({
  selector: 'app-category-tree-node',
  imports: [CategoryTreeNode],
  templateUrl: './category-tree-node.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryTreeNode {
  category = input.required<Category>();
  depth = input(0);
  updatingId = input<string | null>(null);

  edit = output<Category>();
  toggleActive = output<Category>();

  indentClass(): string {
    return INDENT_CLASSES[Math.min(this.depth(), INDENT_CLASSES.length - 1)];
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type SearchInputSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-search-input',
  templateUrl: './search-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchInput {
  value = input('');
  placeholder = input('Buscar...');
  size = input<SearchInputSize>('md');

  valueChange = output<string>();

  sizeClasses = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'w-full max-w-[220px] py-2 text-sm';
      case 'lg':
        return 'w-full max-w-md py-3.5 text-base';
      default:
        return 'w-full max-w-sm py-2.5 text-sm';
    }
  });

  onInput(event: Event) {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}

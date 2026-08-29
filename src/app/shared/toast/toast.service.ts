import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  messages = signal<ToastMessage[]>([]);

  success(text: string) {
    this.show(text, 'success');
  }

  error(text: string) {
    this.show(text, 'error');
  }

  private show(text: string, tone: ToastMessage['tone']) {
    const id = this.nextId++;
    this.messages.update(list => [...list, { id, text, tone }]);
    setTimeout(() => this.dismiss(id), 3000);
  }

  dismiss(id: number) {
    this.messages.update(list => list.filter(m => m.id !== id));
  }
}

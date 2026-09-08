import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificationsService } from '../../../core/services/notifications';
import {
  Notification,
  NotificationTypeValue,
  routeForNotification,
} from '../../../core/models/notification.model';
import { Pagination } from '../../../shared/pagination/pagination';
import { ToastService } from '../../../shared/toast/toast.service';

type ReadFilter = 'all' | 'unread' | 'read';

const TYPE_DOT_CLASS: Record<NotificationTypeValue, string> = {
  Info: 'bg-gr-info',
  Success: 'bg-gr-success',
  Warning: 'bg-gr-warning',
  Error: 'bg-gr-danger',
  Payment: 'bg-gr-info',
  AgentAction: 'bg-gr-primary',
  StockAlert: 'bg-gr-warning',
};

@Component({
  selector: 'app-notifications-list',
  imports: [Pagination, DatePipe],
  templateUrl: './notifications-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsList {
  private notificationsService = inject(NotificationsService);
  private router = inject(Router);
  private toast = inject(ToastService);

  notifications = signal<Notification[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  page = signal(1);
  pageSize = signal(20);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  readFilter = signal<ReadFilter>('all');
  markingAllRead = signal(false);
  removingId = signal<string | null>(null);

  dotClass = (type: string) => TYPE_DOT_CLASS[type as NotificationTypeValue] ?? 'bg-gr-muted';

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.errorMessage.set(null);

    const filter = this.readFilter();
    const isRead = filter === 'all' ? undefined : filter === 'read';

    this.notificationsService.getList(this.page(), this.pageSize(), { isRead }).subscribe({
      next: result => {
        this.notifications.set(result.items);
        this.totalCount.set(result.totalCount);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el listado de notificaciones.');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: ReadFilter) {
    this.readFilter.set(filter);
    this.page.set(1);
    this.load();
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    this.load();
  }

  selectItem(notification: Notification) {
    if (!notification.isRead) {
      this.notificationsService.markRead(notification.id).subscribe();
      this.notifications.update(list =>
        list.map(n => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
      this.notificationsService.unreadCount.update(c => Math.max(0, c - 1));
    }

    const route = routeForNotification(notification);
    if (route) {
      this.router.navigateByUrl(route);
    }
  }

  markAllRead() {
    this.markingAllRead.set(true);
    this.notificationsService.markAllRead().subscribe({
      next: () => {
        this.markingAllRead.set(false);
        this.notificationsService.unreadCount.set(0);
        this.toast.success('Todas las notificaciones marcadas como leídas.');
        this.load();
      },
      error: () => {
        this.markingAllRead.set(false);
        this.toast.error('No se pudo marcar todas como leídas.');
      },
    });
  }

  remove(notification: Notification, event: Event) {
    event.stopPropagation();
    this.removingId.set(notification.id);

    this.notificationsService.remove(notification.id).subscribe({
      next: () => {
        this.removingId.set(null);
        if (!notification.isRead) {
          this.notificationsService.unreadCount.update(c => Math.max(0, c - 1));
        }
        this.load();
      },
      error: () => {
        this.removingId.set(null);
        this.toast.error('No se pudo eliminar la notificación.');
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotificationsService } from '../../core/services/notifications';
import { Notification, NotificationTypeValue, routeForNotification } from '../../core/models/notification.model';

const POLL_INTERVAL_MS = 60_000;
const DROPDOWN_PAGE_SIZE = 8;

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
  selector: 'app-notification-bell',
  imports: [RouterLink],
  templateUrl: './notification-bell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell implements OnDestroy {
  private notificationsService = inject(NotificationsService);
  private router = inject(Router);

  unreadCount = this.notificationsService.unreadCount;
  open = signal(false);
  items = signal<Notification[]>([]);
  loading = signal(false);

  badge = computed(() => (this.unreadCount() > 9 ? '9+' : String(this.unreadCount())));
  dotClass = (type: string) => TYPE_DOT_CLASS[type as NotificationTypeValue] ?? 'bg-gr-muted';

  private pollHandle: ReturnType<typeof setInterval>;

  constructor() {
    this.notificationsService.refreshUnreadCount();
    this.pollHandle = setInterval(() => this.notificationsService.refreshUnreadCount(), POLL_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.pollHandle);
  }

  toggle() {
    this.open.update(v => !v);
    if (this.open() && this.items().length === 0) {
      this.loadDropdown();
    }
  }

  close() {
    this.open.set(false);
  }

  private loadDropdown() {
    this.loading.set(true);
    this.notificationsService.getList(1, DROPDOWN_PAGE_SIZE).subscribe({
      next: result => {
        this.items.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectItem(notification: Notification) {
    this.close();

    if (!notification.isRead) {
      this.notificationsService.markRead(notification.id).subscribe();
      this.items.update(list =>
        list.map(n => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
      this.notificationsService.unreadCount.update(c => Math.max(0, c - 1));
    }

    const route = routeForNotification(notification);
    if (route) {
      this.router.navigateByUrl(route);
    }
  }
}

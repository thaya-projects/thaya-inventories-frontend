import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { ToastContainer } from '../../shared/toast/toast-container';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header, ToastContainer],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  drawerOpen = signal(false);

  openSidebar()  { this.drawerOpen.set(true); }
  closeSidebar() { this.drawerOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { this.drawerOpen.set(false); }
}

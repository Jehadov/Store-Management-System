import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { SidebarComponent } from './shared/sidebar.component';
import { FooterComponent } from './shared/footer.component';
import { ShopService } from './core/shop.service';
import { ThemeService } from './core/theme.service';
import { LayoutService } from './core/layout.service';
import { LangService } from './core/lang.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private shop = inject(ShopService);
  private theme = inject(ThemeService);
  layout = inject(LayoutService);
  lang = inject(LangService);
  ngOnInit() {
    this.theme.init();
    this.layout.init();
    this.shop.load();
  }
}

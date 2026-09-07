import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { ProductDetailComponent } from './features/product/product-detail.component';
import { PosComponent } from './features/pos/pos.component';
import { KitchenComponent } from './features/kitchen/kitchen.component';
import { OrdersComponent } from './features/orders/orders.component';
import { LoginComponent } from './features/login/login.component';
import { AdminComponent } from './features/admin/admin.component';
import { TrackComponent } from './features/track/track.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'product/:id', component: ProductDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: 'track', component: TrackComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'pos', component: PosComponent },
  { path: 'kitchen', component: KitchenComponent },
  { path: 'orders', component: OrdersComponent },
];

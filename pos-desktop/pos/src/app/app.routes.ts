import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HomeComponent } from './features/home/home.component';
import { ProductDetailComponent } from './features/product/product-detail.component';
import { PosComponent } from './features/pos/pos.component';
import { KitchenComponent } from './features/kitchen/kitchen.component';
import { OrdersComponent } from './features/orders/orders.component';
import { LoginComponent } from './features/login/login.component';
import { AdminComponent } from './features/admin/admin.component';
import { TrackComponent } from './features/track/track.component';
import { AuthService, StaffUser } from './core/auth.service';

function roles(...allowed: StaffUser['role'][]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    if (auth.can(...allowed)) return true;
    const router = inject(Router);
    const u = auth.user();
    // logged in but wrong world -> send them to their own home
    return router.createUrlTree([u ? auth.homeFor(u) : '/login']);
  };
}

export const routes: Routes = [
  // customer world (public)
  { path: '', component: HomeComponent },
  { path: 'product/:id', component: ProductDetailComponent },
  { path: 'track', component: TrackComponent },
  { path: 'login', component: LoginComponent },
  // cashier world
  { path: 'pos', component: PosComponent, canActivate: [roles('cashier', 'admin')] },
  { path: 'orders', component: OrdersComponent, canActivate: [roles('cashier', 'admin', 'kitchen')] },
  // kitchen world
  { path: 'kitchen', component: KitchenComponent, canActivate: [roles('kitchen', 'admin')] },
  // admin world
  { path: 'admin', component: AdminComponent, canActivate: [roles('admin')] },
];

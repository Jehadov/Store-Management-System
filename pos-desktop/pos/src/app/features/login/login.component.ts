import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { LangService } from '../../core/lang.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container py-4" [dir]="lang.dir()" style="max-width:420px">
      <h2>{{ lang.pick('Staff login', 'دخول الموظفين') }}</h2>
      <input class="form-control mb-2" [(ngModel)]="username" [placeholder]="lang.pick('Username', 'اسم المستخدم')" />
      <input class="form-control mb-2" [(ngModel)]="password" type="password" [placeholder]="lang.pick('Password', 'كلمة المرور')" />
      <button class="btn btn-primary" (click)="login()">{{ lang.pick('Login', 'دخول') }}</button>
      <p class="text-danger mt-2">{{ error() }}</p>
    </div>
  `,
})
export class LoginComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  lang = inject(LangService);
  username = '';
  password = '';
  error = signal('');
  login() {
    this.api.login(this.username, this.password).subscribe({
      next: (r) => {
        localStorage.setItem('pos_token', r.token);
        localStorage.setItem('pos_user', JSON.stringify(r.user));
        // cashier -> /pos, kitchen -> /kitchen, admin -> /pos
        this.router.navigate([r.user.role === 'kitchen' ? '/kitchen' : '/pos']);
      },
      error: () => this.error.set(this.lang.pick('Invalid credentials', 'بيانات الدخول غير صحيحة')),
    });
  }
}

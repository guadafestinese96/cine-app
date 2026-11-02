import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { errorLegible } from '../../core/utilidades';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Ruta a la que volver después de ingresar (la agregan los guards) */
  volver = input<string>();

  enviando = signal(false);
  error = signal('');

  form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async ingresar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.iniciarSesion(email.trim(), password);
      this.router.navigateByUrl(this.volver() || this.auth.rutaInicial());
    } catch (e) {
      this.error.set(errorLegible(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

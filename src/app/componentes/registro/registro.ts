import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { AvisosService } from '../../services/avisos';
import { CampoFechaComponent } from '../compartidos/campo-fecha/campo-fecha';
import { calcularEdad, errorLegible } from '../../core/utilidades';

/** La fecha de nacimiento tiene que ser real: pasada y con una edad razonable. */
function fechaNacimientoValida(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const edad = calcularEdad(control.value);
  if (edad === null || edad < 0) return { fecha: true };
  if (edad > 110) return { fecha: true };
  return null;
}

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, CampoFechaComponent],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class RegistroComponent {
  private auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);

  readonly tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];
  readonly coloresOjos = ['Marrones', 'Negros', 'Verdes', 'Azules', 'Grises', 'Miel'];

  enviando = signal(false);
  error = signal('');
  pendienteConfirmacion = signal(false);

  form = inject(FormBuilder).nonNullable.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    fecha_nacimiento: ['', [Validators.required, fechaNacimientoValida]],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    dias_vacaciones: [14, [Validators.required, Validators.min(0), Validators.max(365)]],
  });

  invalido(campo: string) {
    const c = this.form.get(campo)!;
    return c.touched && c.invalid;
  }

  elegir(campo: 'tipo_sangre' | 'color_ojos', valor: string) {
    this.form.controls[campo].setValue(valor);
    this.form.controls[campo].markAsTouched();
  }

  async registrar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      const { email, password, ...datos } = this.form.getRawValue();
      const conSesion = await this.auth.registrar(email.trim(), password, { ...datos, dias_vacaciones: Number(datos.dias_vacaciones) });
      if (conSesion) {
        this.avisos.exito(`¡Bienvenido/a, ${datos.nombre}! Tu primera compra tiene descuento.`);
        this.router.navigate(['/catalogo']);
      } else {
        this.pendienteConfirmacion.set(true);
      }
    } catch (e) {
      this.error.set(errorLegible(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

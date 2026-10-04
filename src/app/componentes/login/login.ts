import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  formLogin: FormGroup;
  mensaje: string = '';

  constructor(
    private fb: FormBuilder, 
    private supabase: SupabaseService,
    private router: Router
  ) {
    this.formLogin = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  async onSubmit() {
    if (this.formLogin.invalid) return;

    try {
      const { email, password } = this.formLogin.value;
      const data = await this.supabase.iniciarSesion(email, password);
      
      if (data.user) {
        // Consultar los datos adicionales de la tabla 'usuarios'
        const { data: perfilData, error: perfilError } = await this.supabase.client
          .from('usuarios')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!perfilError && perfilData) {
          // Guardar en el localStorage tal como lo espera el componente de ticket y cupones
          localStorage.setItem('usuario_logueado', JSON.stringify(perfilData));
        }
      }

      this.mensaje = '¡Inicio de sesión exitoso!';
      
      setTimeout(() => {
        this.router.navigate(['/catalogo']);
      }, 1000);

    } catch (error: any) {
      console.error('Error completo:', error);
      this.mensaje = 'Error al registrar: ' + (error.message || JSON.stringify(error));
    }
  }

  irARegistro() {
    this.router.navigate(['/registro']);
  }
}
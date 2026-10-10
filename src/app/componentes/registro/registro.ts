import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

//Directiva Componente - plantilla visual
@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class RegistroComponent {
  formRegistro: FormGroup;
  mensaje: string = '';

  constructor(private fb: FormBuilder, private supabase: SupabaseService) {
    this.formRegistro = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      fecha_nacimiento: ['', Validators.required],
      tipo_sangre: ['', Validators.required],
      color_ojos: ['', Validators.required],
      dias_vacaciones: [0, [Validators.required, Validators.min(0)]]
    });
  }

  async onSubmit() {
    if (this.formRegistro.invalid) return;

    try {
      const { email, password, ...perfil } = this.formRegistro.value;
      await this.supabase.registrarUsuario(email, password, perfil);
      this.mensaje = '¡Registro exitoso! Ya podés iniciar sesión.';
      this.formRegistro.reset();
    } catch (error: any) {
      this.mensaje = 'Error al registrar: ' + error.message;
    }
  }
}
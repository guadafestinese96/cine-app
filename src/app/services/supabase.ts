import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  public client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async registrarUsuario(email: string, password: string, datosPerfil: any) {
    // 1. Crear el usuario en la autenticación de Supabase
    const { data: authData, error: authError } = await this.client.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    // 2. Insertar los datos adicionales en la tabla 'usuarios'
    if (authData.user) {
      const { error: dbError } = await this.client.from('usuarios').insert([
        {
          id: authData.user.id,
          email: email, // Si tenés el email como columna en la tabla de usuarios
          nombre: datosPerfil.nombre,
          apellido: datosPerfil.apellido,
          fecha_nacimiento: datosPerfil.fecha_nacimiento,
          tipo_sangre: datosPerfil.tipo_sangre,
          color_ojos: datosPerfil.color_ojos,
          dias_vacaciones: datosPerfil.dias_vacaciones,
        },
      ]);

      if (dbError) throw dbError;
    }

    return authData;
  }

  async iniciarSesion(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  // Función auxiliar para obtener el usuario actual en sesión
  async obtenerUsuarioActual() {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    return user;
  }
}

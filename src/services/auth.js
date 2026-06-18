// ─── Auth utilities ───────────────────────────────────────────

export function translateAuthError(error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('user not found') || msg.includes('no user found'))
        return { bold: 'El correo ingresado no está registrado.', italic: 'Verifica que sea correcto o crea una cuenta nueva.' };
    if (msg.includes('invalid password') || msg.includes('wrong password'))
        return { bold: 'La contraseña no es correcta.', italic: 'Intenta nuevamente o restablece tu contraseña.' };
    if (msg.includes('invalid email') || msg.includes('unable to validate email'))
        return { bold: 'El correo no tiene un formato válido.', italic: 'Revisa que incluya @ y un dominio.' };
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already registered'))
        return { bold: 'Este correo ya tiene una cuenta.', italic: 'Intenta iniciar sesión o usa otro correo.' };
    if (msg.includes('password should be') || msg.includes('password must'))
        return { bold: 'La contraseña es demasiado corta.', italic: 'Debe tener al menos 6 caracteres.' };
    if (msg.includes('rate limit') || msg.includes('too many'))
        return { bold: 'Demasiados intentos.', italic: 'Espera unos minutos antes de intentarlo de nuevo.' };
    return { bold: 'Error al autenticar.', italic: 'Intenta de nuevo en unos momentos.' };
}

// Emisor ficticio para las pruebas: Certo ya no trae uno por omisión
// (credenciales-comunitarias, decisión 0011) y se niega a firmar sin él.
process.env.ISSUER_PROFILE_NAME ??= 'Emisor de prueba'
process.env.ISSUER_PROFILE_URL ??= 'https://emisor.example.test'

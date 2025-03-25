import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://nwxisyjucugaacoujama.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eGlzeWp1Y3VnYWFjb3VqYW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMTIxMzYsImV4cCI6MjA1NDg4ODEzNn0.i6V5pqS_zGL7XFWhGdEJdlOJ7dyjXifLD_gGofZpnJY"; // Usa la tua chiave pubblica
const supabase = createClient(supabaseUrl, supabaseKey);

document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const messageEl = document.getElementById('message');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });

  if (error) {
    messageEl.textContent = "Errore: " + error.message;
    messageEl.classList.add("text-red-500");
  } else {
    messageEl.textContent = "Email inviata! Controlla la tua posta.";
    messageEl.classList.add("text-green-500");
  }
});

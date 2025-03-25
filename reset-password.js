import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://nwxisyjucugaacoujama.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eGlzeWp1Y3VnYWFjb3VqYW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMTIxMzYsImV4cCI6MjA1NDg4ODEzNn0.i6V5pqS_zGL7XFWhGdEJdlOJ7dyjXifLD_gGofZpnJY";
const supabase = createClient(supabaseUrl, supabaseKey);

document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const messageEl = document.getElementById('message');

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    messageEl.textContent = "Errore: " + error.message;
    messageEl.classList.add("text-red-500");
  } else {
    messageEl.textContent = "Password aggiornata! Ora puoi accedere.";
    messageEl.classList.add("text-green-500");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  }
});

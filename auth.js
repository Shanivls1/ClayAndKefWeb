// Sign-in for the dashboard (Supabase Auth, email + password).
// The real protection is in the database (migrations/20261016_lock_down.sql): without a signed-in account listed in
// public.staff, every table, view and function refuses. This file only decides what the screen shows.

import { supabase } from './supabase.js';

// Resolves once a staff member is signed in (shows the sign-in screen until then).
export async function requireStaff() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const access = await checkStaff();
    if (access === true) return showApp(session);
    if (access === false) await supabase.auth.signOut();
    return new Promise(resolve => showLogin(resolve, access === false ? notStaffMessage : access));
  }
  return new Promise(resolve => showLogin(resolve));
}

// After signing out (here or in another tab) or when the session can't be renewed: start clean.
export function watchSignOut() {
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') location.reload();
  });
  document.getElementById('btn-sign-out')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    await supabase.auth.signOut();
    location.reload();
  });
}

const notStaffMessage = 'This account doesn’t have access to the dashboard.';

// true / false, or a readable error when it couldn't be checked
async function checkStaff() {
  const { data, error } = await supabase.rpc('is_staff');
  if (error) return `Couldn’t check access (${error.message}). Try again.`;
  return data === true;
}

function showApp(session) {
  document.body.dataset.auth = 'in';
  document.getElementById('login')?.remove();
  const who = document.getElementById('signed-in-as');
  if (who) who.textContent = session.user?.email ?? '';
  return session;
}

function showLogin(resolve, message = '') {
  document.body.dataset.auth = 'out';
  const box = document.getElementById('login');
  const form = box.querySelector('form');
  const email = form.elements.email, password = form.elements.password;
  const button = form.querySelector('button[type="submit"]');
  const error = box.querySelector('#login-error');
  const say = text => { error.textContent = text; error.hidden = !text; };
  say(message);
  (email.value ? password : email).focus();

  box.querySelector('#login-show').addEventListener('click', e => {
    const showing = password.type === 'text';
    password.type = showing ? 'password' : 'text';
    e.currentTarget.textContent = showing ? 'Show' : 'Hide';
    e.currentTarget.setAttribute('aria-pressed', String(!showing));
    password.focus();
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!email.value.trim() || !password.value) { say('Enter your email and password.'); return; }
    button.disabled = true;
    button.textContent = 'Signing in…';
    say('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (signInError) {
      button.disabled = false;
      button.textContent = 'Sign in';
      say(/invalid login|invalid credentials/i.test(signInError.message) ? 'Wrong email or password.'
        : /rate|too many/i.test(signInError.message) ? 'Too many attempts. Wait a few minutes and try again.'
        : `Couldn’t sign in: ${signInError.message}`);
      password.select();
      return;
    }
    const access = await checkStaff();
    if (access !== true) {
      await supabase.auth.signOut({ scope: 'local' });
      button.disabled = false;
      button.textContent = 'Sign in';
      say(access === false ? notStaffMessage : access);
      return;
    }
    password.value = '';
    resolve(showApp(data.session));
  });
}

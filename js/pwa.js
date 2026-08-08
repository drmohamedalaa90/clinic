window.addEventListener('load', () => {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker', err));
  }
});

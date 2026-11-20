(function () {
  const layout = document.getElementById('layout');
  const menu = document.getElementById('menu');
  const menuLink = document.getElementById('menuLink');

  if (!layout || !menu || !menuLink) return;

  menuLink.addEventListener('click', (event) => {
    event.preventDefault();
    layout.classList.toggle('active');
    menu.classList.toggle('active');
    menuLink.classList.toggle('active');
  });
})();

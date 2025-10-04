// Color Filter Functionality
document.addEventListener('DOMContentLoaded', () => {
  const filterCards = document.querySelectorAll('.filter-card');
  const currentFilterDisplay = document.getElementById('currentFilterDisplay');
  const filterName = document.getElementById('filterName');
  
  const filterNames = {
    'normal': 'Normal',
    'invert': 'Inverted',
    'grayscale': 'Grayscale',
    'high-contrast': 'High Contrast',
    'high-contrast-black': 'High Contrast Dark',
    'high-contrast-white': 'High Contrast Light',
    'sepia': 'Sepia',
    'dark-mode': 'Dark Mode'
  };
  
  // Load saved filter from localStorage
  const savedFilter = localStorage.getItem('colorFilter') || 'normal';
  applyFilter(savedFilter);
  
  // Add click event to filter cards
  filterCards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.getAttribute('data-filter');
      applyFilter(filter);
      saveFilter(filter);
    });
  });
  
  function applyFilter(filter) {
    // Remove all filter classes
    document.body.classList.remove('normal', 'invert', 'grayscale', 'high-contrast', 'high-contrast-black', 'high-contrast-white', 'sepia', 'dark-mode');
    
    // Add selected filter
    if (filter !== 'normal') {
      document.body.classList.add(filter);
    }
    
    // Update active card
    filterCards.forEach(card => {
      if (card.getAttribute('data-filter') === filter) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
    
    // Update display
    filterName.textContent = filterNames[filter];
    currentFilterDisplay.classList.add('show');
    
    // Hide display after 3 seconds
    setTimeout(() => {
      currentFilterDisplay.classList.remove('show');
    }, 3000);
    
    // Speak filter change
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`Filter changed to ${filterNames[filter]}`);
      utterance.rate = 1.2;
      speechSynthesis.speak(utterance);
    }
  }
  
  function saveFilter(filter) {
    localStorage.setItem('colorFilter', filter);
  }
  
  // Keyboard shortcuts for filters
  document.addEventListener('keydown', (e) => {
    if (e.altKey) {
      switch(e.key) {
        case '1':
          applyFilter('normal');
          saveFilter('normal');
          break;
        case '2':
          applyFilter('invert');
          saveFilter('invert');
          break;
        case '3':
          applyFilter('grayscale');
          saveFilter('grayscale');
          break;
        case '4':
          applyFilter('high-contrast');
          saveFilter('high-contrast');
          break;
        case '5':
          applyFilter('sepia');
          saveFilter('sepia');
          break;
      }
    }
  });
});
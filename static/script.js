// Joe Nicol
$(document).ready(function() {
    // Search autocomplete functionality
    const searchInput = $('input[name="q"]');
    const autocompleteList = $('<div class="autocomplete-items"></div>');
    searchInput.parent().append(autocompleteList);
    
    $('.search-form').on('submit', function(e) {
        const query = searchInput.val().trim();
        if (!query) {
            e.preventDefault();
            searchInput.val('').focus();
        }
    });

    // Debounced search
    let debounceTimer;
    searchInput.on('input', function() {
        const query = $(this).val().trim();
        clearTimeout(debounceTimer);
        
        if (!query) {
            autocompleteList.empty();
            return;
        }

        debounceTimer = setTimeout(() => {
            $.get('/autocomplete', { q: query }, function(suggestions) {
                autocompleteList.empty();
                
                suggestions.forEach(place => {
                    const div = $('<div class="autocomplete-item"></div>')
                        .html(`
                            <span class="place-name">${place.name}</span>
                            <span class="place-location">${place.location}</span>
                        `)
                        .on('click', function() {
                            searchInput.val(place.name);
                            autocompleteList.empty();
                            $('.search-form').submit();
                        });
                    autocompleteList.append(div);
                });
            });
        }, 300);
    });

    // Close autocomplete on outside click
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.search-form').length) {
            autocompleteList.empty();
        }
    });

    // Rating bar calculation
    function calculateRatingPercentage(rating) {
        try {
            return Math.min(Math.max(parseFloat(rating) * 10, 0), 100) + '%';
        } catch (error) {
            return '0%';
        }
    }

    // Initialize rating bars
    function initRatingBars() {
        const ratingBars = document.querySelectorAll('.rating-bar-progress');
        ratingBars.forEach(bar => {
            const rating = bar.getAttribute('data-rating');
            bar.style.width = calculateRatingPercentage(rating);
        });
    }

    // Initialize parallax
    function initParallax() {
        const images = document.querySelectorAll('[data-parallax="scroll"] img');
        images.forEach(img => {
            new simpleParallax(img, {
                scale: 1.0,
                orientation: 'up',
                overflow: true,
                delay: 0.4,
                transition: 'cubic-bezier(0,0,0,1)',
                maxTransition: 50
            });
        });
    }

    // Form handling functions
    function handleFormSubmit(formData, url, successCallback) {
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                successCallback(data);
            } else {
                showFormErrors(data.errors);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }

    function showFormErrors(errors) {
        Object.entries(errors).forEach(([field, message]) => {
            const element = document.getElementById(field) || 
                          document.querySelector(`[name="${field}"]`);
            if (element) {
                element.classList.add('is-invalid');
                element.nextElementSibling.textContent = message;
            }
        });
    }

    // Form Handling for Add and Edit pages
    function initializeForms() {
        const addForm = document.getElementById('add-form');
        const editForm = document.getElementById('edit-form');
        
        if (addForm) {
            initializeAddForm(addForm);
        }
        
        if (editForm) {
            initializeEditForm(editForm);
        }
    }

    function initializeAddForm(form) {
        const successMessage = document.getElementById('success-message');
        const similarPlaces = document.getElementById('similar_places');
        
        if (similarPlaces) {
            limitSimilarPlacesSelection(similarPlaces);
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            resetFormValidation(form);
            
            const formData = collectFormData(form);
            handleFormSubmit(formData, '/api/add', function(data) {
                successMessage.style.display = 'block';
                document.getElementById('view-link').href = `/view/${data.id}`;
                form.reset();
                document.getElementById('name').focus();
            });
        });
    }

    function initializeEditForm(form) {
        const discardBtn = document.getElementById('discard-btn');
        const discardModal = new bootstrap.Modal(document.getElementById('discardModal'));
        const confirmDiscardBtn = document.getElementById('confirm-discard');
        const placeId = form.dataset.placeId;

        if (discardBtn) {
            discardBtn.addEventListener('click', () => discardModal.show());
        }

        if (confirmDiscardBtn) {
            confirmDiscardBtn.addEventListener('click', function() {
                window.location.href = `/view/${placeId}`;
            });
        }

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            resetFormValidation(form);
            
            const formData = collectFormData(form);
            handleFormSubmit(formData, `/api/edit/${placeId}`, function() {
                window.location.href = `/view/${placeId}`;
            });
        });
    }

    function limitSimilarPlacesSelection(select) {
        select.addEventListener('change', function() {
            if (this.selectedOptions.length > 3) {
                Array.from(this.selectedOptions)
                    .slice(3)
                    .forEach(option => option.selected = false);
            }
        });
    }

    function collectFormData(form) {
        return {
            name: document.getElementById('name').value.trim(),
            location: document.getElementById('location').value.trim(),
            image: document.getElementById('image').value.trim(),
            alt_text: document.getElementById('alt_text').value.trim(),
            rating: document.getElementById('rating').value.trim(),
            summary: document.getElementById('summary').value.trim(),
            information: document.getElementById('information').value.trim(),
            'average cost': document.getElementById('average_cost').value.trim(),
            'target traveller': Array.from(form.querySelectorAll('input[name="target traveller"]:checked')).map(cb => cb.value),
            'similar place ids': Array.from(document.getElementById('similar_places').selectedOptions).map(option => option.value)
        };
    }

    function resetFormValidation(form) {
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    // Initialize all components
    initRatingBars();
    initParallax();
    initializeForms();

    function loadPopularPlaces() {
        $.get('/api/popular-places', function(places) {
            const placesGrid = $('#places-grid');
            placesGrid.empty();

            places.forEach(place => {
                const placeCard = $(`
                    <div class="place-card">
                        <img src="${place.image}" alt="${place.name}">
                        <div class="place-info">
                            <h3>${place.name}</h3>
                            <p class="location">${place.location}</p>
                            <div class="rating">Rating: ${place.rating}/10</div>
                            <a href="/view/${place.id}" class="btn btn-primary">Learn More</a>
                        </div>
                    </div>
                `);
                placesGrid.append(placeCard);
            });
        });
    }

    if ($('#places-grid').length) {
        loadPopularPlaces();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const parallaxContainer = document.querySelector('.hero-image-container');
    let ticking = false;
    let lastScrollY = window.scrollY;

    function updateParallax() {
        const scrolled = window.scrollY;
        const speed = 0.5;
        const yPos = -(scrolled * speed);
        
        parallaxContainer.style.transform = `translate3d(0, ${yPos}px, 0)`;
        
        ticking = false;
    }

    window.addEventListener('scroll', function() {
        lastScrollY = window.scrollY;
        
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateParallax();
                ticking = false;
            });
            
            ticking = true;
        }
    });
});

function initializeHeroParallax(container) {
    let ticking = false;
    let lastScrollY = window.scrollY;

    function updateParallax() {
        const scrolled = window.scrollY;
        const speed = 0.5;
        const yPos = -(scrolled * speed);
        
        container.style.transform = `translate3d(0, ${yPos}px, 0)`;
        ticking = false;
    }

    window.addEventListener('scroll', function() {
        lastScrollY = window.scrollY;
        
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateParallax();
                ticking = false;
            });
            ticking = true;
        }
    });
} 
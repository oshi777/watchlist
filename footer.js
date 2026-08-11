/**
 * Universal Footer Component
 * Automatically adds a footer to any page that includes this script
 */

(function() {
    'use strict';
    
    // Footer configuration
    const FOOTER_CONFIG = {
        siteName: 'Watchly',
        version: '2.0',
        description: 'Your Personal Movie & TV Tracking Platform',
        links: [
            { text: 'Home', url: 'index.html' },
            { text: 'Browse', url: 'search.html' },
            { text: 'Leaderboard', url: 'leaderboard.html' },
            { text: 'Backup', url: 'backup.html' },
            { text: 'Guide', url: 'guide.html' },
            { text: 'Settings', url: 'settings.html' }
        ],
        showYear: true,
        showTMDB: false
    };

    function createFooter() {
        const footer = document.createElement('footer');
        footer.className = 'universal-footer';
        
        const currentYear = new Date().getFullYear();
        
        footer.innerHTML = `
            <div class="footer-container">
                <div class="footer-content">
                    <div class="footer-brand">
                        <h3>${FOOTER_CONFIG.siteName}</h3>
                        <p>${FOOTER_CONFIG.description}</p>
                    </div>
                    
                    <div class="footer-links">
                        <h4>Quick Links</h4>
                        <ul>
                            ${FOOTER_CONFIG.links.map(link => 
                                `<li><a href="${link.url}">${link.text}</a></li>`
                            ).join('')}
                        </ul>
                    </div>
                    
                    <div class="footer-legal">
                        <h4>Legal</h4>
                        <ul>
                            <li><a href="terms.html">Terms of Service</a></li>
                            <li><a href="privacy.html">Privacy Policy</a></li>
                        </ul>
                    </div>
                    
                    <div class="footer-info">
                        <div class="footer-version">v${FOOTER_CONFIG.version}</div>
                    </div>
                </div>
                
                ${FOOTER_CONFIG.showYear ? `<div class="footer-bottom">
                    <p>&copy; ${currentYear} ${FOOTER_CONFIG.siteName}. Built for movie and TV enthusiasts.</p>
                </div>` : ''}
            </div>
        `;
        
        return footer;
    }

    function addFooterStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .universal-footer {
                background: linear-gradient(135deg, #0d0e12 0%, #1a1d23 100%);
                border-top: 1px solid rgba(195,199,206,0.1);
                margin-top: 60px;
                padding: 40px 0 20px;
                color: var(--silver);
                font-size: 0.85rem;
            }

            .footer-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 20px;
            }

            .footer-content {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr;
                gap: 40px;
                margin-bottom: 30px;
            }

            .footer-brand h3 {
                font-size: 1.4rem;
                font-weight: 800;
                color: var(--light);
                margin-bottom: 8px;
                background: linear-gradient(135deg, var(--light) 0%, var(--silver) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .footer-brand p {
                color: var(--silver);
                line-height: 1.5;
                margin: 0;
            }

            .footer-links h4 {
                font-size: 1rem;
                font-weight: 700;
                color: var(--light);
                margin-bottom: 12px;
            }

            .footer-links ul {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .footer-links a {
                color: var(--silver);
                text-decoration: none;
                transition: color 0.2s ease;
                font-size: 0.9rem;
            }

            .footer-links a:hover {
                color: var(--light);
            }

            .footer-legal h4 {
                font-size: 1rem;
                font-weight: 700;
                color: var(--light);
                margin-bottom: 12px;
            }

            .footer-legal ul {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .footer-legal a {
                color: var(--silver);
                text-decoration: none;
                transition: color 0.2s ease;
                font-size: 0.9rem;
            }

            .footer-legal a:hover {
                color: var(--light);
            }

            .footer-info {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .footer-version {
                font-size: 0.8rem;
                padding: 4px 10px;
                background: rgba(195,199,206,0.1);
                border: 1px solid rgba(195,199,206,0.2);
                border-radius: 12px;
                color: var(--silver);
                text-align: center;
                font-weight: 600;
                width: fit-content;
            }

            .footer-bottom {
                padding-top: 20px;
                border-top: 1px solid rgba(195,199,206,0.1);
                text-align: center;
            }

            .footer-bottom p {
                margin: 0;
                font-size: 0.8rem;
                color: var(--muted);
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .footer-content {
                    grid-template-columns: 1fr;
                    gap: 30px;
                    text-align: center;
                }

                .footer-links ul {
                    flex-direction: row;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 16px;
                }

                .footer-info {
                    align-items: center;
                }

                .universal-footer {
                    margin-top: 40px;
                    padding: 30px 0 16px;
                }
            }

            @media (max-width: 480px) {
                .footer-container {
                    padding: 0 16px;
                }

                .footer-content {
                    gap: 24px;
                }

                .footer-brand h3 {
                    font-size: 1.2rem;
                }

                .footer-links ul {
                    gap: 12px;
                }

                .footer-links a {
                    font-size: 0.85rem;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Initialize footer when DOM is ready
    function initFooter() {
        // Add styles first
        addFooterStyles();
        
        // Create and append footer
        const footer = createFooter();
        
        // Find the best place to insert the footer
        const body = document.body;
        const container = document.querySelector('.container');
        const lastScript = Array.from(document.querySelectorAll('script')).pop();
        
        // Remove existing TMDB attribution if present (since we include it in footer)
        const existingTmdbAttribution = document.querySelector('.tmdb-attribution');
        if (existingTmdbAttribution) {
            existingTmdbAttribution.remove();
        }
        
        // Initialize scroll prevention system
        initScrollPrevention();
        
        // Insert footer before the last script tag, or append to body
        if (lastScript && lastScript.parentNode === body) {
            body.insertBefore(footer, lastScript);
        } else {
            body.appendChild(footer);
        }
    }

    // Scroll Prevention System
    function initScrollPrevention() {
        // Add CSS for preventing scroll
        const scrollPreventionCSS = document.createElement('style');
        scrollPreventionCSS.textContent = `
            .modal-open {
                overflow: hidden !important;
                position: fixed !important;
                width: 100% !important;
                height: 100% !important;
                top: 0 !important;
                left: 0 !important;
            }
            
            .modal-open .container {
                position: static !important;
            }
        `;
        document.head.appendChild(scrollPreventionCSS);

        // Track scroll position
        let scrollPosition = 0;
        
        // Function to prevent scrolling
        function preventScroll() {
            scrollPosition = window.pageYOffset;
            document.body.style.top = `-${scrollPosition}px`;
            document.body.classList.add('modal-open');
        }
        
        // Function to restore scrolling
        function restoreScroll() {
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, scrollPosition);
        }
        
        // Monitor for modal changes
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.classList.contains('modal')) {
                        const isVisible = target.style.display === 'block' || 
                                        (target.style.display !== 'none' && 
                                         getComputedStyle(target).display === 'block');
                        
                        if (isVisible) {
                            preventScroll();
                        } else {
                            // Check if any other modals are still open
                            const openModals = document.querySelectorAll('.modal[style*="display: block"], .modal[style*="display:block"]');
                            if (openModals.length === 0) {
                                restoreScroll();
                            }
                        }
                    }
                }
            });
        });
        
        // Observe all modals
        document.querySelectorAll('.modal').forEach(modal => {
            observer.observe(modal, { 
                attributes: true, 
                attributeFilter: ['style'] 
            });
        });
        
        // Also handle navigation menu blur overlay
        const siteBlur = document.getElementById('siteBlur');
        if (siteBlur) {
            const blurObserver = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const hasActive = siteBlur.classList.contains('active');
                        if (hasActive) {
                            preventScroll();
                        } else {
                            // Only restore if no modals are open
                            const openModals = document.querySelectorAll('.modal[style*="display: block"], .modal[style*="display:block"]');
                            if (openModals.length === 0) {
                                restoreScroll();
                            }
                        }
                    }
                });
            });
            
            blurObserver.observe(siteBlur, { 
                attributes: true, 
                attributeFilter: ['class'] 
            });
        }
        
        // Handle escape key to close modals and restore scroll
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="display: block"], .modal[style*="display:block"]');
                if (openModals.length > 0) {
                    openModals.forEach(modal => {
                        modal.style.display = 'none';
                    });
                    restoreScroll();
                }
            }
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooter);
    } else {
        initFooter();
    }

})();
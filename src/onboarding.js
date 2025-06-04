/**
 * Interactive Onboarding System
 * 
 * Guides new users through the "Drop the damn link" experience with
 * an interactive demo showcasing AI-powered organization.
 */

class OnboardingManager {
    constructor(app) {
        this.app = app;
        this.currentStep = 0;
        this.totalSteps = 9;
        this.isActive = false;
        this.overlay = null;
        this.spotlight = null;
        
        // Demo content for interactive experience
        this.demoBookmarks = [
            {
                url: 'https://github.com/unclecode/crawl4ai',
                title: 'Crawl4AI - Web Crawler for LLMs',
                description: '🔥 Open-source web crawler specifically designed for Large Language Models and AI applications. Extract clean, formatted data from any website.',
                expectedFolder: 'Development Tools'
            },
            {
                url: 'https://x.com/unclecode',
                title: 'Unclecode (@unclecode) / X',
                description: 'AI enthusiast, founder of Kidocode. Creator of Crawl4AI. Sharing insights about AI, tech, and entrepreneurship.',
                expectedFolder: 'Social Media'
            },
            {
                url: 'https://towardsdatascience.com/web-scraping-for-ai-training-data-best-practices-2024',
                title: 'Web Scraping for AI Training Data: Best Practices',
                description: 'A comprehensive guide to gathering high-quality training data for machine learning models.',
                expectedFolder: 'AI & Tech Articles'
            },
            {
                url: 'https://techcrunch.com/2024/01/15/ai-automation-trends-2024',
                title: 'AI Automation Trends Shaping 2024',
                description: 'Explore the latest developments in artificial intelligence and automation technology.',
                expectedFolder: 'Tech News'
            }
        ];
        
        // Demo URL for interactive step
        this.interactiveDemoUrl = 'https://github.com/unclecode/crawl4ai';
        
        this.steps = [
            { type: 'welcome', title: 'Welcome to Drop the Damn Link!' },
            { type: 'philosophy', title: 'The AI-First Approach' },
            { type: 'add-bookmark', title: 'Let\'s Add Your First Link' },
            { type: 'watch-processing', title: 'AI at Work' },
            { type: 'folder-reveal', title: 'Magic Happens!' },
            { type: 'search-demo', title: 'Find Anything Instantly' },
            { type: 'manual-control', title: 'You\'re Still in Charge' },
            { type: 'view-modes', title: 'Your Way, Your Style' },
            { type: 'celebration', title: 'You\'re All Set!' }
        ];
    }

    /**
     * Check if user needs onboarding (empty database)
     */
    async shouldShowOnboarding() {
        try {
            const bookmarks = await this.app.dataProvider.getBookmarks();
            const folders = await this.app.dataProvider.getFolders();
            return bookmarks.length === 0 && folders.length === 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Start the onboarding experience
     */
    async start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentStep = 0;
        
        // Create overlay system
        this.createOverlay();
        
        // Start with welcome step
        await this.showStep(0);
    }

    /**
     * Create the tooltip system
     */
    createOverlay() {
        // Just a container for tooltips - no blocking overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'onboarding-container';
        document.body.appendChild(this.overlay);
        
        this.isActive = true;
    }

    /**
     * Create a tooltip attached to a specific element
     */
    createTooltip(targetSelector, title, message, options = {}) {
        const target = document.querySelector(targetSelector);
        if (!target) return null;

        // Remove any existing tooltip
        this.removeCurrentTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-progress">
                    <span class="progress-text">Step ${this.currentStep + 1} of ${this.totalSteps}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((this.currentStep + 1) / this.totalSteps) * 100}%"></div>
                    </div>
                </div>
                <button class="tooltip-skip" title="Skip tour">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="tooltip-content">
                <h3 class="tooltip-title">${title}</h3>
                <div class="tooltip-message">${message}</div>
            </div>
            <div class="tooltip-actions">
                ${this.currentStep > 0 ? '<button class="btn btn-outline tooltip-prev"><i class="fas fa-arrow-left"></i> Previous</button>' : ''}
                <button class="btn btn-primary tooltip-next">${options.nextText || 'Next'} <i class="fas fa-arrow-right"></i></button>
            </div>
            <div class="tooltip-arrow"></div>
        `;

        // Position tooltip relative to target
        const position = this.calculateTooltipPosition(target, tooltip);
        tooltip.style.position = 'fixed';
        tooltip.style.left = position.left + 'px';
        tooltip.style.top = position.top + 'px';
        tooltip.setAttribute('data-position', position.placement);

        this.overlay.appendChild(tooltip);
        
        // Add highlight to target element
        target.classList.add('onboarding-highlight');
        
        // Setup event handlers
        this.setupTooltipHandlers(tooltip, options);
        
        // Store references
        this.currentTooltip = tooltip;
        this.currentTarget = target;
        
        // Animate in
        setTimeout(() => tooltip.classList.add('active'), 50);
        
        return tooltip;
    }

    /**
     * Calculate optimal position for tooltip
     */
    calculateTooltipPosition(target, tooltip) {
        document.body.appendChild(tooltip); // Temporarily add to measure
        
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        const spacing = 15;
        let placement = 'bottom'; // default
        let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        let top = targetRect.bottom + spacing;
        
        // Check if tooltip fits below target
        if (top + tooltipRect.height > viewport.height - 20) {
            // Try above
            top = targetRect.top - tooltipRect.height - spacing;
            placement = 'top';
            
            if (top < 20) {
                // Try to the right
                left = targetRect.right + spacing;
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                placement = 'right';
                
                if (left + tooltipRect.width > viewport.width - 20) {
                    // Try to the left
                    left = targetRect.left - tooltipRect.width - spacing;
                    placement = 'left';
                }
            }
        }
        
        // Keep tooltip within viewport bounds
        left = Math.max(20, Math.min(left, viewport.width - tooltipRect.width - 20));
        top = Math.max(20, Math.min(top, viewport.height - tooltipRect.height - 20));
        
        document.body.removeChild(tooltip); // Remove temporary element
        
        return { left, top, placement };
    }

    /**
     * Setup tooltip event handlers
     */
    setupTooltipHandlers(tooltip, options) {
        // Skip button
        const skipBtn = tooltip.querySelector('.tooltip-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.complete());
        }
        
        // Next button
        const nextBtn = tooltip.querySelector('.tooltip-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (options.onNext) {
                    options.onNext();
                } else {
                    this.nextStep();
                }
            });
        }
        
        // Previous button
        const prevBtn = tooltip.querySelector('.tooltip-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousStep());
        }
    }

    /**
     * Remove current tooltip and highlight
     */
    removeCurrentTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
        
        if (this.currentTarget) {
            this.currentTarget.classList.remove('onboarding-highlight');
            this.currentTarget = null;
        }
        
        // Remove any temporary click handlers
        if (this.tempClickHandler) {
            document.removeEventListener('click', this.tempClickHandler, true);
            this.tempClickHandler = null;
        }
    }


    /**
     * Show a specific onboarding step
     */
    async showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) return;
        
        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];
        
        // Update content based on step type
        switch (step.type) {
            case 'welcome':
                await this.showWelcomeStep();
                break;
            case 'philosophy':
                await this.showPhilosophyStep();
                break;
            case 'add-bookmark':
                await this.showAddBookmarkStep();
                break;
            case 'watch-processing':
                await this.showWatchProcessingStep();
                break;
            case 'folder-reveal':
                await this.showFolderRevealStep();
                break;
            case 'search-demo':
                await this.showSearchDemoStep();
                break;
            case 'manual-control':
                await this.showManualControlStep();
                break;
            case 'view-modes':
                await this.showViewModesStep();
                break;
            case 'celebration':
                await this.showCelebrationStep();
                break;
        }
    }

    /**
     * Step 1: Welcome message
     */
    async showWelcomeStep() {
        this.createTooltip(
            '.logo',
            'Welcome to Drop the Damn Link! 🚀',
            `
            <div class="welcome-content">
                <p>Tired of organizing bookmarks manually? We've got you covered!</p>
                <p><strong>Philosophy:</strong> <em>"Drop the damn link, let AI organize it!"</em></p>
                <p>Ready for a quick interactive tour? Let's show you how it works!</p>
            </div>
            `,
            { nextText: 'Let\'s Go! 🚀' }
        );
    }

    /**
     * Step 2: Explain the philosophy
     */
    async showPhilosophyStep() {
        this.createTooltip(
            '#clustering-toggle',
            'AI-First Organization 🤖',
            `
            <div class="philosophy-content">
                <p><strong>🧠 Smart Content Analysis</strong> - AI reads and understands your links</p>
                <p><strong>📁 Automatic Folders</strong> - Creates perfect folders without thinking</p>
                <p><strong>🔍 Intelligent Search</strong> - Find anything by content, not just titles</p>
                <p style="margin-top: 15px;"><strong>You focus on collecting, AI handles organizing!</strong></p>
            </div>
            `,
            { nextText: 'Show Me How!' }
        );
    }

    /**
     * Step 3: Guide user to add bookmark
     */
    async showAddBookmarkStep() {
        // Monitor for modal opening
        this.waitForModalToOpen();
        
        this.createTooltip(
            '#add-bookmark-btn',
            'Let\'s Add Your First Link! ➕',
            `
            <div class="add-bookmark-guide">
                <p>Ready to see the magic? I'll open the bookmark dialog and pre-fill it for you!</p>
                <p>We'll add the Crawl4AI project and watch AI organize it automatically!</p>
            </div>
            `,
            { 
                nextText: 'Open Dialog & Pre-fill! 🚀',
                onNext: () => {
                    // Programmatically click the Add Bookmark button
                    const addBtn = document.getElementById('add-bookmark-btn');
                    if (addBtn) {
                        addBtn.click();
                    }
                }
            }
        );
    }
    
    /**
     * Wait for bookmark modal to open and auto-advance
     */
    waitForModalToOpen() {
        const modal = document.getElementById('add-bookmark-modal');
        if (!modal) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (modal.classList.contains('active')) {
                        console.log('🎯 Onboarding: Modal opened, pre-filling and advancing...');
                        observer.disconnect();
                        
                        // Pre-fill immediately
                        setTimeout(() => {
                            this.prefillBookmarkModal();
                            // Auto-advance to next step
                            setTimeout(() => this.nextStep(), 10);
                        }, 10);
                    }
                }
            });
        });
        
        observer.observe(modal, { attributes: true });
        console.log('👂 Onboarding: Watching for modal to open...');
    }

    /**
     * Step 4: Show processing magic
     */
    async showWatchProcessingStep() {
        this.createTooltip(
            '#save-bookmark',
            'Watch AI at Work! 🤖',
            `
            <div class="processing-demo">
                <p>Perfect! I've pre-filled the Crawl4AI GitHub repository.</p>
                <p>Ready to watch the AI magic happen? I'll save the bookmark for you!</p>
                <p><em>Watch the notifications - AI will fetch content and create the perfect folder!</em></p>
            </div>
            `,
            { 
                nextText: 'Save & Watch Magic! ✨',
                onNext: () => {
                    // Show loading step
                    this.showLoadingStep();
                    
                    // Set up event listener for bookmark completion
                    this.waitForBookmarkComplete();
                    
                    // Programmatically click the Save Bookmark button
                    setTimeout(() => {
                        const saveBtn = document.getElementById('save-bookmark');
                        if (saveBtn) {
                            saveBtn.click();
                        }
                    }, 100);
                }
            }
        );
    }
    
    /**
     * Step 4.5: Show loading while processing
     */
    showLoadingStep() {
        this.createTooltip(
            '.logo',
            'AI is Working... 🤖⚡',
            `
            <div class="loading-demo">
                <div class="loading-content">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: var(--primary);"></i>
                    </div>
                    <p style="margin-top: 15px;">✨ AI is analyzing the content...</p>
                    <p>📁 Creating the perfect folder...</p>
                    <p>🚀 Almost done!</p>
                </div>
            </div>
            `,
            { 
                nextText: 'Please wait...',
                onNext: () => {
                    // Disabled during loading
                }
            }
        );
        
        // Disable the next button during loading
        const nextBtn = this.currentTooltip?.querySelector('.tooltip-next');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.5';
            nextBtn.style.cursor = 'not-allowed';
        }
    }
    
    /**
     * Wait for bookmark processing to complete
     */
    waitForBookmarkComplete() {
        const handleComplete = (event) => {
            console.log('🎯 Onboarding: Received bookmark complete event', event.detail);
            
            // Remove event listener
            document.removeEventListener('bookmarkProcessingComplete', handleComplete);
            
            // Wait a bit to show the success, then advance
            setTimeout(() => {
                this.nextStep();
            }, 1500);
        };
        
        document.addEventListener('bookmarkProcessingComplete', handleComplete);
        console.log('👂 Onboarding: Listening for bookmark completion...');
    }
    

    /**
     * Step 5: Reveal folder creation
     */
    async showFolderRevealStep() {
        this.createTooltip(
            '.sidebar',
            'Magic Happened! ✨',
            `
            <div class="folder-reveal">
                <p>🎉 Look at that! AI analyzed the content and created <strong>"Group 1"</strong> in the sidebar!</p>
                
                <div style="background: var(--bg-hover); padding: 12px; border-radius: 8px; margin: 12px 0; border-left: 3px solid var(--primary);">
                    <p><strong>About "Group 1" naming:</strong></p>
                    <p>• AI heuristically groups similar content into categories</p>
                    <p>• You can <strong>rename</strong> "Group 1" to anything you like!</p>
                    <p>• Or keep it simple - it's just a smart container 📁</p>
                    <p style="margin-top: 8px; font-size: 12px; opacity: 0.8;"><em>Coming soon: AI will also suggest meaningful names!</em></p>
                </div>
                
                <p><strong>The magic:</strong> You didn't organize anything - AI did it all! 🤖</p>
            </div>
            `,
            { nextText: 'I understand! ✨' }
        );
    }

    /**
     * Step 6: Demonstrate search
     */
    async showSearchDemoStep() {
        this.createTooltip(
            '.search-bar',
            'Find Anything Instantly 🔍',
            `
            <div class="search-demo">
                <p>AI extracted all the content, so you can find things by titles, descriptions, and content!</p>
                <p>I'll search for <strong>"crawl"</strong> to show you how it works!</p>
            </div>
            `,
            { 
                nextText: 'Demo Search! 🔍',
                onNext: () => {
                    // Pre-fill search for demo
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.value = 'crawl';
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        searchInput.focus();
                        console.log('🔍 Onboarding: Filled search with "crawl"');

                    }
                    setTimeout(() => this.nextStep(), 1000);
                }
            }
        );
    }

    /**
     * Step 7: Show manual control
     */
    async showManualControlStep() {
        this.createTooltip(
            '#add-folder-btn',
            'You\'re Still in Charge! 👑',
            `
            <div class="manual-control">
                <p>Don't worry - you have full control when you need it:</p>
                <p><strong>📁 Create custom folders</strong></p>
                <p><strong>✏️ Edit any bookmark</strong></p>
                <p><strong>🤖 Toggle AI clustering on/off</strong></p>
                <p>AI helps when you want it, stays out of the way when you don't!</p>
            </div>
            `,
            { nextText: 'Perfect Balance!' }
        );
    }

    /**
     * Step 8: Show view modes
     */
    async showViewModesStep() {
        this.createTooltip(
            '.view-toggle',
            'Your Way, Your Style 🎨',
            `
            <div class="view-modes">
                <p>Choose how you want to see your bookmarks:</p>
                <div class="view-options">
                    <div class="view-option">
                        <i class="fas fa-th-large"></i>
                        <strong>Card View</strong>
                        <span>Rich visual previews</span>
                    </div>
                    <div class="view-option">
                        <i class="fas fa-list"></i>
                        <strong>Table View</strong>
                        <span>Compact, scannable lists</span>
                    </div>
                </div>
                <p>Try clicking the view toggle buttons above! ↗️</p>
            </div>
            `,
            { nextText: 'Let\'s Celebrate! 🎉' }
        );
    }

    /**
     * Step 9: Celebration and completion
     */
    async showCelebrationStep() {
        this.createTooltip(
            '.logo',
            'You\'re All Set! 🎉',
            `
            <div class="celebration">
                <div class="celebration-content">
                    <h3>🚀 Welcome to the Future of Bookmarking!</h3>
                    <p>You now know how to:</p>
                    <ul class="achievement-list">
                        <li>✅ Drop links and let AI organize them</li>
                        <li>✅ Search by content, not just titles</li>
                        <li>✅ Create manual folders when needed</li>
                        <li>✅ Switch between view modes</li>
                    </ul>
                    <div class="final-message">
                        <strong>That's it! Drop any link, AI organizes everything.</strong><br>
                        <em>Your digital life just got easier! 🎯</em>
                    </div>
                </div>
            </div>
            `,
            { nextText: 'Start Organizing! 🚀' }
        );
        
        // Trigger confetti
        this.showConfetti();
    }



    /**
     * Pre-fill bookmark modal with demo content
     */
    prefillBookmarkModal() {
        // Try multiple times with increasing delays to ensure modal is fully loaded
        const attemptPrefill = (attempt = 1) => {
            const urlInput = document.getElementById('bookmark-url');
            const titleInput = document.getElementById('bookmark-title');
            
            if (urlInput && titleInput) {
                urlInput.value = this.interactiveDemoUrl;
                titleInput.value = 'Crawl4AI - Web Crawler for LLMs';
                console.log('✅ Onboarding: Pre-filled modal with demo content');
                
                // Trigger input events to ensure any listeners are notified
                urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (attempt < 5) {
                // Try again with longer delay
                console.log(`⏳ Onboarding: Attempt ${attempt} - Modal not ready, retrying...`);
                setTimeout(() => attemptPrefill(attempt + 1), attempt * 100);
            } else {
                console.warn('⚠️ Onboarding: Failed to pre-fill modal after 5 attempts');
            }
        };
        
        setTimeout(() => attemptPrefill(), 50);
    }


    /**
     * Go to next step
     */
    nextStep() {
        if (this.currentStep < this.totalSteps - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.complete();
        }
    }

    /**
     * Go to previous step
     */
    previousStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    /**
     * Show confetti animation
     */
    showConfetti() {
        // Create confetti animation
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.animationDelay = Math.random() * 3 + 's';
                confetti.style.backgroundColor = ['#50ffff', '#ff3c74', '#22c55e', '#f59e0b'][Math.floor(Math.random() * 4)];
                
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 100);
        }
    }

    /**
     * Complete onboarding
     */
    complete() {
        this.isActive = false;
        
        // Mark onboarding as completed
        localStorage.setItem('onboarding_completed', 'true');
        
        // Animate out and remove overlay
        this.overlay.classList.remove('active');
        setTimeout(() => {
            if (this.overlay && this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, 300);
        
        // Show completion notification
        this.app.showNotification('Welcome aboard! Start dropping those links! 🚀', 'success');
    }

    /**
     * Check if onboarding was already completed
     */
    isCompleted() {
        return localStorage.getItem('onboarding_completed') === 'true';
    }
}

export { OnboardingManager };
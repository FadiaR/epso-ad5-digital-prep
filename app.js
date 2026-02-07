// EPSO AD5 Digital Skills Test - Enhanced Application
// Complete quiz application with timer, statistics, and multiple modes

// ============================================================================
// GLOBAL STATE
// ============================================================================

let allQuestions = [];
let currentTest = {
    mode: 'mock', // 'practice', 'mock', 'theme'
    questions: [],
    currentIndex: 0,
    answers: {},
    flagged: new Set(),
    startTime: null,
    endTime: null,
    timerInterval: null,
    timeRemaining: 1800 // 30 minutes in seconds
};

let userStats = {
    totalTests: 0,
    testHistory: [],
    themePerformance: {},
    dailyPractice: {}, // { "2026-02-07": 3600 } - seconds practiced per day
    practiceStreak: 0,
    longestStreak: 0
};

// Daily practice tracking
const DAILY_GOAL_SECONDS = 90 * 60; // 1 hour 30 minutes
let dailySessionStart = null;
let dailySessionInterval = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    await loadQuestions();
    loadUserStats();
    updateWelcomeStats();
    setupKeyboardShortcuts();
    setupStickyHeader();
    startDailyPracticeTracking();
    showLoading(false);
});

async function loadQuestions() {
    try {
        const response = await fetch('digital.v1.0.json');
        allQuestions = await response.json();
        console.log(`Loaded ${allQuestions.length} questions`);
        updateThemeCounts();
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Error loading questions. Please refresh the page.');
    }
}

function updateThemeCounts() {
    const themes = {
        'Information & data literacy': 0,
        'Communication & collaboration': 0,
        'Digital content creation': 0,
        'Safety': 0,
        'Problem solving': 0
    };
    
    allQuestions.forEach(q => {
        if (themes.hasOwnProperty(q.theme)) {
            themes[q.theme]++;
        }
    });
    
    document.getElementById('count-info').textContent = `${themes['Information & data literacy']} questions`;
    document.getElementById('count-comm').textContent = `${themes['Communication & collaboration']} questions`;
    document.getElementById('count-content').textContent = `${themes['Digital content creation']} questions`;
    document.getElementById('count-safety').textContent = `${themes['Safety']} questions`;
    document.getElementById('count-problem').textContent = `${themes['Problem solving']} questions`;
}

// ============================================================================
// TEST MODES
// ============================================================================

function startTest(mode) {
    currentTest.mode = mode;
    
    if (mode === 'theme') {
        showScreen('theme-screen');
    } else if (mode === 'practice') {
        initializeTest(10, false, true);
    } else if (mode === 'mock') {
        initializeTest(40, true, false);
    }
}

function startThemeTest() {
    const checkboxes = document.querySelectorAll('.theme-checkboxes input[type="checkbox"]:checked');
    const selectedThemes = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedThemes.length === 0) {
        alert('Please select at least one theme');
        return;
    }
    
    const filteredQuestions = allQuestions.filter(q => selectedThemes.includes(q.theme));
    initializeTest(Math.min(20, filteredQuestions.length), false, true, filteredQuestions);
}

function initializeTest(questionCount, timed, showFeedback, questions = null) {
    // Select random questions
    const sourceQuestions = questions || allQuestions;
    const shuffled = sourceQuestions.sort(() => 0.5 - Math.random());
    currentTest.questions = shuffled.slice(0, questionCount);
    
    // Reset test state
    currentTest.currentIndex = 0;
    currentTest.answers = {};
    currentTest.flagged = new Set();
    currentTest.startTime = Date.now();
    currentTest.endTime = null;
    currentTest.showFeedback = showFeedback;
    currentTest.timed = timed;
    currentTest.timeRemaining = timed ? 1800 : null; // 30 minutes
    
    // Show quiz screen and render
    showScreen('quiz-screen');
    renderQuestionGrid();
    renderQuestion();
    
    // Start timer if needed
    if (timed) {
        startTimer();
    } else {
        document.querySelector('.timer-container').style.display = 'none';
    }
}

// ============================================================================
// QUESTION RENDERING
// ============================================================================

function renderQuestionGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    
    currentTest.questions.forEach((_, index) => {
        const btn = document.createElement('button');
        btn.className = 'q-nav';
        btn.textContent = index + 1;
        btn.onclick = () => jumpToQuestion(index);
        
        // Add classes based on state
        if (index === currentTest.currentIndex) {
            btn.classList.add('current');
        }
        if (currentTest.answers[index] !== undefined) {
            btn.classList.add('answered');
        }
        if (currentTest.flagged.has(index)) {
            btn.classList.add('flagged');
            btn.textContent += ' 🚩';
        }
        
        grid.appendChild(btn);
    });
}

function renderQuestion() {
    const question = currentTest.questions[currentTest.currentIndex];
    const index = currentTest.currentIndex;
    
    // Update question number
    document.getElementById('question-number').textContent = 
        `Question ${index + 1} of ${currentTest.questions.length}`;
    
    // Update answered count
    const answeredCount = Object.keys(currentTest.answers).length;
    document.getElementById('answered-count').textContent = 
        `Answered: ${answeredCount}/${currentTest.questions.length}`;
    
    // Update theme badge
    document.getElementById('question-theme').textContent = question.theme;
    
    // Update question text
    document.getElementById('question-text').textContent = question.q;
    
    // Render options
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
    question.opts.forEach((option, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${String.fromCharCode(65 + i)}. ${option}`;
        btn.onclick = () => selectAnswer(i);
        
        // Mark if selected
        if (currentTest.answers[index] === i) {
            btn.classList.add('selected');
        }
        
        container.appendChild(btn);
    });
    
    // Update flag button
    updateFlagButton();
    
    // Update navigation buttons
    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').textContent = 
        index === currentTest.questions.length - 1 ? 'Finish →' : 'Next →';
    
    // Show feedback if in practice mode and answer selected
    if (currentTest.showFeedback && currentTest.answers[index] !== undefined) {
        showFeedback();
    } else {
        document.getElementById('feedback').style.display = 'none';
    }
    
    // Update question grid
    renderQuestionGrid();
}

function selectAnswer(optionIndex) {
    currentTest.answers[currentTest.currentIndex] = optionIndex;
    renderQuestion();
    
    // In practice mode, show feedback immediately
    if (currentTest.showFeedback) {
        showFeedback();
    }
}

function showFeedback() {
    const question = currentTest.questions[currentTest.currentIndex];
    const userAnswer = currentTest.answers[currentTest.currentIndex];
    const correctAnswer = question.a;
    const isCorrect = userAnswer === correctAnswer;
    
    const feedback = document.getElementById('feedback');
    feedback.style.display = 'block';
    
    feedback.innerHTML = `
        <div class="feedback-${isCorrect ? 'correct' : 'incorrect'}">
            <div class="feedback-icon">${isCorrect ? '✅' : '❌'}</div>
            <div class="feedback-content">
                <h4>${isCorrect ? 'Correct!' : 'Incorrect'}</h4>
                ${!isCorrect ? `<p><strong>Correct answer:</strong> ${String.fromCharCode(65 + correctAnswer)}. ${question.opts[correctAnswer]}</p>` : ''}
                <p><strong>Explanation:</strong> ${question.exp}</p>
            </div>
        </div>
    `;
}

// ============================================================================
// NAVIGATION
// ============================================================================

function nextQuestion() {
    if (currentTest.currentIndex < currentTest.questions.length - 1) {
        currentTest.currentIndex++;
        renderQuestion();
    } else {
        confirmSubmit();
    }
}

function previousQuestion() {
    if (currentTest.currentIndex > 0) {
        currentTest.currentIndex--;
        renderQuestion();
    }
}

function jumpToQuestion(index) {
    currentTest.currentIndex = index;
    renderQuestion();
}

function toggleFlag() {
    const index = currentTest.currentIndex;
    if (currentTest.flagged.has(index)) {
        currentTest.flagged.delete(index);
    } else {
        currentTest.flagged.add(index);
    }
    updateFlagButton();
    renderQuestionGrid();
}

function updateFlagButton() {
    const btn = document.getElementById('flag-btn');
    const icon = document.getElementById('flag-icon');
    
    if (currentTest.flagged.has(currentTest.currentIndex)) {
        btn.classList.add('flagged');
        icon.textContent = '🚩';
        btn.innerHTML = `${icon.outerHTML} Unflag`;
    } else {
        btn.classList.remove('flagged');
        icon.textContent = '🚩';
        btn.innerHTML = `${icon.outerHTML} Flag for Review`;
    }
}

// ============================================================================
// TIMER
// ============================================================================

function startTimer() {
    const timerDisplay = document.getElementById('timer');
    
    currentTest.timerInterval = setInterval(() => {
        currentTest.timeRemaining--;
        
        const minutes = Math.floor(currentTest.timeRemaining / 60);
        const seconds = currentTest.timeRemaining % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Warning at 5 minutes
        if (currentTest.timeRemaining === 300) {
            timerDisplay.classList.add('warning');
            alert('5 minutes remaining!');
        }
        
        // Auto-submit at 0
        if (currentTest.timeRemaining <= 0) {
            clearInterval(currentTest.timerInterval);
            submitTest();
        }
    }, 1000);
}

function stopTimer() {
    if (currentTest.timerInterval) {
        clearInterval(currentTest.timerInterval);
    }
}

// ============================================================================
// TEST SUBMISSION
// ============================================================================

function confirmSubmit() {
    const answered = Object.keys(currentTest.answers).length;
    const total = currentTest.questions.length;
    
    document.getElementById('modal-answered').textContent = answered;
    document.getElementById('modal-total').textContent = total;
    
    if (answered < total) {
        document.getElementById('modal-unanswered').style.display = 'block';
    } else {
        document.getElementById('modal-unanswered').style.display = 'none';
    }
    
    document.getElementById('submit-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('submit-modal').style.display = 'none';
}

function submitTest() {
    closeModal();
    stopTimer();
    currentTest.endTime = Date.now();
    
    // Calculate results
    const results = calculateResults();
    
    // Save to history
    saveTestToHistory(results);
    
    // Show results
    displayResults(results);
}

function calculateResults() {
    let correct = 0;
    const themeResults = {};
    
    currentTest.questions.forEach((question, index) => {
        const userAnswer = currentTest.answers[index];
        const isCorrect = userAnswer === question.a;
        
        if (isCorrect) correct++;
        
        // Track by theme
        if (!themeResults[question.theme]) {
            themeResults[question.theme] = { correct: 0, total: 0 };
        }
        themeResults[question.theme].total++;
        if (isCorrect) themeResults[question.theme].correct++;
    });
    
    const timeSpent = Math.floor((currentTest.endTime - currentTest.startTime) / 1000);
    const total = currentTest.questions.length;
    const percentage = Math.round((correct / total) * 100);
    const passed = percentage >= 50;
    
    return {
        correct,
        total,
        percentage,
        passed,
        timeSpent,
        themeResults,
        mode: currentTest.mode
    };
}

function displayResults(results) {
    // Show results screen
    showScreen('results-screen');
    
    // Display score
    document.getElementById('final-score').textContent = `${results.correct}/${results.total}`;
    document.getElementById('score-percentage').textContent = `${results.percentage}%`;
    
    const statusEl = document.getElementById('pass-status');
    if (results.passed) {
        statusEl.textContent = '✅ PASSED (Need 20/40)';
        statusEl.className = 'pass-status passed';
    } else {
        statusEl.textContent = '❌ NOT PASSED (Need 20/40)';
        statusEl.className = 'pass-status failed';
    }
    
    // Display time
    const minutes = Math.floor(results.timeSpent / 60);
    const seconds = results.timeSpent % 60;
    document.getElementById('time-taken').textContent = 
        `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Display theme breakdown
    const themeContainer = document.getElementById('theme-results');
    themeContainer.innerHTML = '';
    
    Object.entries(results.themeResults).forEach(([theme, stats]) => {
        const percentage = Math.round((stats.correct / stats.total) * 100);
        
        const div = document.createElement('div');
        div.className = 'theme-result';
        div.innerHTML = `
            <div class="theme-result-header">
                <span class="theme-result-name">${theme}</span>
                <span class="theme-result-score">${stats.correct}/${stats.total} (${percentage}%)</span>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width: ${percentage}%"></div>
            </div>
        `;
        
        themeContainer.appendChild(div);
    });
}

// ============================================================================
// STATISTICS
// ============================================================================

function loadUserStats() {
    const saved = localStorage.getItem('epsoStats');
    if (saved) {
        userStats = JSON.parse(saved);
    }
}

function saveUserStats() {
    localStorage.setItem('epsoStats', JSON.stringify(userStats));
}

function saveTestToHistory(results) {
    userStats.totalTests++;
    userStats.testHistory.push({
        date: new Date().toISOString(),
        ...results
    });
    
    // Update theme performance
    Object.entries(results.themeResults).forEach(([theme, stats]) => {
        if (!userStats.themePerformance[theme]) {
            userStats.themePerformance[theme] = { correct: 0, total: 0 };
        }
        userStats.themePerformance[theme].correct += stats.correct;
        userStats.themePerformance[theme].total += stats.total;
    });
    
    // Keep only last 50 tests
    if (userStats.testHistory.length > 50) {
        userStats.testHistory = userStats.testHistory.slice(-50);
    }
    
    saveUserStats();
}

function updateWelcomeStats() {
    document.getElementById('total-tests').textContent = userStats.totalTests;
    
    if (userStats.testHistory.length > 0) {
        const avgScore = Math.round(
            userStats.testHistory.reduce((sum, test) => sum + test.percentage, 0) / 
            userStats.testHistory.length
        );
        document.getElementById('avg-score').textContent = `${avgScore}%`;
        
        const bestTest = userStats.testHistory.reduce((best, test) => 
            test.correct > best.correct ? test : best
        );
        document.getElementById('best-score').textContent = `${bestTest.correct}/${bestTest.total}`;
    }
    
    // Update streak display
    const streakEl = document.getElementById('practice-streak-count');
    if (streakEl) {
        const streakText = userStats.practiceStreak === 1 ? 'day' : 'days';
        streakEl.textContent = `${userStats.practiceStreak} ${streakText} streak`;
    }
}

function showStatistics() {
    showScreen('statistics-screen');
    
    // Update overview stats
    document.getElementById('stats-total-tests').textContent = userStats.totalTests;
    
    if (userStats.testHistory.length > 0) {
        const avgScore = Math.round(
            userStats.testHistory.reduce((sum, test) => sum + test.percentage, 0) / 
            userStats.testHistory.length
        );
        document.getElementById('stats-avg-score').textContent = `${avgScore}%`;
        
        const bestTest = userStats.testHistory.reduce((best, test) => 
            test.correct > best.correct ? test : best
        );
        document.getElementById('stats-best-score').textContent = `${bestTest.correct}/${bestTest.total}`;
        
        const passedTests = userStats.testHistory.filter(t => t.passed).length;
        const passRate = Math.round((passedTests / userStats.testHistory.length) * 100);
        document.getElementById('stats-pass-rate').textContent = `${passRate}%`;
        
        // Render chart
        renderScoreChart();
        
        // Render theme stats
        renderThemeStats();
    }
}

function renderScoreChart() {
    const ctx = document.getElementById('score-chart').getContext('2d');
    
    const labels = userStats.testHistory.map((_, i) => `Test ${i + 1}`);
    const data = userStats.testHistory.map(test => test.percentage);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score (%)',
                data: data,
                borderColor: '#003399',
                backgroundColor: 'rgba(0, 51, 153, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderThemeStats() {
    const container = document.getElementById('theme-stats-content');
    container.innerHTML = '';
    
    Object.entries(userStats.themePerformance).forEach(([theme, stats]) => {
        const percentage = Math.round((stats.correct / stats.total) * 100);
        
        const div = document.createElement('div');
        div.className = 'theme-stat-item';
        div.innerHTML = `
            <div class="theme-stat-header">
                <span>${theme}</span>
                <span>${stats.correct}/${stats.total} (${percentage}%)</span>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width: ${percentage}%"></div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

function clearStatistics() {
    if (confirm('Are you sure you want to clear all statistics? This cannot be undone.')) {
        userStats = { totalTests: 0, testHistory: [], themePerformance: {} };
        saveUserStats();
        updateWelcomeStats();
        showScreen('welcome-screen');
    }
}

// ============================================================================
// REVIEW & EXPORT
// ============================================================================

function reviewIncorrect() {
    const incorrectQuestions = [];
    
    currentTest.questions.forEach((question, index) => {
        const userAnswer = currentTest.answers[index];
        if (userAnswer !== question.a) {
            incorrectQuestions.push({ ...question, index });
        }
    });
    
    if (incorrectQuestions.length === 0) {
        alert('Perfect score! No incorrect answers to review.');
        return;
    }
    
    // Create new test with only incorrect questions
    currentTest.questions = incorrectQuestions;
    currentTest.currentIndex = 0;
    currentTest.answers = {};
    currentTest.showFeedback = true;
    currentTest.timed = false;
    
    showScreen('quiz-screen');
    document.querySelector('.timer-container').style.display = 'none';
    renderQuestionGrid();
    renderQuestion();
}

function exportResults() {
    const results = calculateResults();
    
    const csv = [
        ['EPSO AD5 Digital Skills Test Results'],
        [''],
        ['Date', new Date().toLocaleDateString()],
        ['Score', `${results.correct}/${results.total}`],
        ['Percentage', `${results.percentage}%`],
        ['Status', results.passed ? 'PASSED' : 'NOT PASSED'],
        ['Time', `${Math.floor(results.timeSpent / 60)}:${(results.timeSpent % 60).toString().padStart(2, '0')}`],
        [''],
        ['Theme Performance'],
        ['Theme', 'Correct', 'Total', 'Percentage']
    ];
    
    Object.entries(results.themeResults).forEach(([theme, stats]) => {
        csv.push([
            theme,
            stats.correct,
            stats.total,
            `${Math.round((stats.correct / stats.total) * 100)}%`
        ]);
    });
    
    const csvContent = csv.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `epso-ad5-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ============================================================================
// UTILITIES
// ============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Load dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only if quiz is active
        if (!document.getElementById('quiz-screen').classList.contains('active')) {
            return;
        }
        
        // Prevent shortcuts if modal is open
        if (document.getElementById('submit-modal').style.display === 'flex') {
            return;
        }
        
        switch(e.key) {
            case '1':
            case 'a':
            case 'A':
                selectAnswer(0);
                break;
            case '2':
            case 'b':
            case 'B':
                selectAnswer(1);
                break;
            case '3':
            case 'c':
            case 'C':
                selectAnswer(2);
                break;
            case '4':
            case 'd':
            case 'D':
                selectAnswer(3);
                break;
            case 'n':
            case 'N':
            case 'ArrowRight':
                nextQuestion();
                break;
            case 'p':
            case 'P':
            case 'ArrowLeft':
                previousQuestion();
                break;
            case 'f':
            case 'F':
                toggleFlag();
                break;
            case '?':
                toggleShortcutsHint();
                break;
        }
    });
}

function toggleShortcutsHint() {
    const hint = document.getElementById('shortcuts-hint');
    hint.style.display = hint.style.display === 'none' ? 'block' : 'none';
}

// Hide shortcuts hint after 5 seconds on load
setTimeout(() => {
    document.getElementById('shortcuts-hint').style.display = 'none';
}, 5000);

// ============================================================================
// DAILY PRACTICE TRACKING
// ============================================================================

function startDailyPracticeTracking() {
    const today = getTodayDate();
    
    // Initialize today's practice if needed
    if (!userStats.dailyPractice[today]) {
        userStats.dailyPractice[today] = 0;
    }
    
    // Start session timer
    dailySessionStart = Date.now();
    
    // Update every second
    dailySessionInterval = setInterval(() => {
        updateDailyPracticeTime();
    }, 1000);
    
    // Update display
    updateDailyPracticeDisplay();
    updateCalendar();
}

function updateDailyPracticeTime() {
    if (!dailySessionStart) return;
    
    const today = getTodayDate();
    const sessionTime = Math.floor((Date.now() - dailySessionStart) / 1000);
    const previousTime = userStats.dailyPractice[today] || 0;
    const totalToday = previousTime + sessionTime;
    
    // Update display (don't save yet, only on page unload)
    updateDailyPracticeDisplay(totalToday);
    
    // Check if goal completed
    if (totalToday >= DAILY_GOAL_SECONDS && previousTime < DAILY_GOAL_SECONDS) {
        celebrateGoalCompletion();
    }
}

function updateDailyPracticeDisplay(customTime = null) {
    const today = getTodayDate();
    const totalToday = customTime !== null ? customTime : (userStats.dailyPractice[today] || 0);
    
    const minutes = Math.floor(totalToday / 60);
    const seconds = totalToday % 60;
    const goalMinutes = Math.floor(DAILY_GOAL_SECONDS / 60);
    
    const percentage = Math.min((totalToday / DAILY_GOAL_SECONDS) * 100, 100);
    
    // Update timer display
    const timerEl = document.getElementById('daily-practice-timer');
    if (timerEl) {
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} / ${goalMinutes}min`;
    }
    
    // Update progress bar
    const progressEl = document.getElementById('daily-practice-progress');
    if (progressEl) {
        progressEl.style.width = `${percentage}%`;
    }
    
    // Update percentage text
    const percentEl = document.getElementById('daily-practice-percent');
    if (percentEl) {
        percentEl.textContent = `${Math.floor(percentage)}%`;
    }
}

function saveDailyPracticeTime() {
    if (!dailySessionStart) return;
    
    const today = getTodayDate();
    const sessionTime = Math.floor((Date.now() - dailySessionStart) / 1000);
    const previousTime = userStats.dailyPractice[today] || 0;
    
    userStats.dailyPractice[today] = previousTime + sessionTime;
    
    // Update streak
    updateStreak();
    
    saveUserStats();
    dailySessionStart = Date.now(); // Reset session start
}

function updateStreak() {
    const dates = Object.keys(userStats.dailyPractice).sort().reverse();
    let streak = 0;
    let currentDate = new Date();
    
    for (let i = 0; i < dates.length; i++) {
        const checkDate = dates[i];
        const expectedDate = getTodayDate(new Date(currentDate - i * 86400000));
        
        if (checkDate === expectedDate && userStats.dailyPractice[checkDate] >= DAILY_GOAL_SECONDS) {
            streak++;
        } else {
            break;
        }
    }
    
    userStats.practiceStreak = streak;
    if (streak > userStats.longestStreak) {
        userStats.longestStreak = streak;
    }
}

function getTodayDate(date = new Date()) {
    return date.toISOString().split('T')[0];
}

function celebrateGoalCompletion() {
    // Create celebration overlay
    const celebration = document.createElement('div');
    celebration.className = 'celebration-overlay';
    celebration.innerHTML = `
        <div class="celebration-content">
            <div class="celebration-icon">🎉</div>
            <h2>Daily Goal Completed!</h2>
            <p>You've practiced for 1h 30min today!</p>
            <div class="celebration-streak">
                <span class="streak-number">${userStats.practiceStreak + 1}</span>
                <span class="streak-label">Day Streak 🔥</span>
            </div>
            <button onclick="closeCelebration()" class="btn-primary">Continue Practicing</button>
        </div>
    `;
    
    document.body.appendChild(celebration);
    
    // Trigger confetti animation
    createConfetti();
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        closeCelebration();
    }, 5000);
}

function closeCelebration() {
    const overlay = document.querySelector('.celebration-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function createConfetti() {
    const colors = ['#003399', '#FFD700', '#28a745', '#dc3545', '#ffc107'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
    }
}

// ============================================================================
// CALENDAR
// ============================================================================

function updateCalendar() {
    const calendarEl = document.getElementById('practice-calendar');
    if (!calendarEl) return;
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    let html = `
        <div class="calendar-header">
            <h3>${firstDay.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        </div>
        <div class="calendar-days">
            <div class="calendar-day-name">Mon</div>
            <div class="calendar-day-name">Tue</div>
            <div class="calendar-day-name">Wed</div>
            <div class="calendar-day-name">Thu</div>
            <div class="calendar-day-name">Fri</div>
            <div class="calendar-day-name">Sat</div>
            <div class="calendar-day-name">Sun</div>
        </div>
        <div class="calendar-grid">
    `;
    
    // Add empty cells for days before month starts
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < startDay; i++) {
        html += '<div class="calendar-cell empty"></div>';
    }
    
    // Add days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateStr = getTodayDate(date);
        const practiced = userStats.dailyPractice[dateStr] || 0;
        const goalMet = practiced >= DAILY_GOAL_SECONDS;
        const isToday = dateStr === getTodayDate();
        
        let className = 'calendar-cell';
        if (isToday) className += ' today';
        if (goalMet) className += ' completed';
        else if (practiced > 0) className += ' partial';
        
        const minutes = Math.floor(practiced / 60);
        
        html += `
            <div class="${className}" title="${dateStr}: ${minutes} minutes">
                <div class="calendar-day-number">${day}</div>
                ${goalMet ? '<div class="calendar-checkmark">✓</div>' : ''}
                ${practiced > 0 && !goalMet ? `<div class="calendar-minutes">${minutes}m</div>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    calendarEl.innerHTML = html;
}

// ============================================================================
// STICKY HEADER
// ============================================================================

function setupStickyHeader() {
    let lastScroll = 0;
    const header = document.querySelector('.app-header');
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll <= 0) {
            header.classList.remove('scroll-up');
            return;
        }
        
        if (currentScroll > lastScroll && currentScroll > 100) {
            // Scrolling down
            header.classList.remove('scroll-up');
            header.classList.add('scroll-down');
        } else if (currentScroll < lastScroll) {
            // Scrolling up
            header.classList.remove('scroll-down');
            header.classList.add('scroll-up');
        }
        
        lastScroll = currentScroll;
    });
}

// Save practice time before page unload
window.addEventListener('beforeunload', () => {
    saveDailyPracticeTime();
});

// Save practice time periodically (every 30 seconds)
setInterval(() => {
    saveDailyPracticeTime();
}, 30000);

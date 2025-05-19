document.addEventListener('DOMContentLoaded', () => {
    fetch('funny_content.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(contentSets => {
            if (!contentSets || contentSets.length === 0) {
                console.error('No content sets found or content is empty.');
                // Optionally, display a default static message if JSON is empty or fails to load
                displayStaticFallback();
                return;
            }

            const randomIndex = Math.floor(Math.random() * contentSets.length);
            const selectedContent = contentSets[randomIndex];

            const mainHeadline = document.getElementById('mainHeadline');
            const introMessage = document.getElementById('introMessage');
            const actionPrompt = document.getElementById('actionPrompt');
            const funnyImage = document.getElementById('funnyImage');
            const refocusTipsList = document.getElementById('refocusTipsList');

            if (mainHeadline) mainHeadline.textContent = selectedContent.headline;
            if (introMessage) introMessage.textContent = selectedContent.intro;
            if (actionPrompt) actionPrompt.textContent = selectedContent.actionPrompt;
            if (funnyImage && selectedContent.image) {
                funnyImage.src = selectedContent.image;
                funnyImage.alt = selectedContent.headline; // Use headline as alt text
                funnyImage.style.display = 'block';
            } else if (funnyImage) {
                funnyImage.style.display = 'none'; // Hide if no image URL
            }

            if (refocusTipsList && selectedContent.funnyTips && selectedContent.funnyTips.length > 0) {
                refocusTipsList.innerHTML = ''; // Clear existing static tips
                selectedContent.funnyTips.forEach(tip => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = tip; // Using innerHTML to allow for <strong> etc. in tips
                    refocusTipsList.appendChild(listItem);
                });
            } else if (refocusTipsList) {
                // Optionally hide or display default tips if no funnyTips are provided
                refocusTipsList.innerHTML = '<li>Consider taking a short break!</li>'; 
            }
        })
        .catch(error => {
            console.error('Error fetching or processing funny_content.json:', error);
            // Display a static fallback message in case of any error
            displayStaticFallback();
        });
});

function displayStaticFallback() {
    // This function provides a basic static message if the dynamic content fails to load.
    const mainHeadline = document.getElementById('mainHeadline');
    const introMessage = document.getElementById('introMessage');
    const actionPrompt = document.getElementById('actionPrompt');
    const refocusTipsList = document.getElementById('refocusTipsList');
    const funnyImage = document.getElementById('funnyImage');

    if (mainHeadline) mainHeadline.textContent = "Time to Refocus!";
    if (introMessage) introMessage.textContent = "Looks like that site is taking a break. Good time to get back on track!";
    if (actionPrompt) actionPrompt.textContent = "Here are some classic refocus tips:";
    if (funnyImage) funnyImage.style.display = 'none'; // Hide image on fallback

    if (refocusTipsList) {
        refocusTipsList.innerHTML = ''; // Clear just in case
        const tips = [
            "Take a Short Break: Stand up, stretch, or grab a glass of water.",
            "Review Your Goals: Briefly look at your to-do list for today.",
            "The Pomodoro Technique: Work in focused 25-minute intervals."
        ];
        tips.forEach(tipText => {
            const listItem = document.createElement('li');
            listItem.textContent = tipText;
            refocusTipsList.appendChild(listItem);
        });
    }
}
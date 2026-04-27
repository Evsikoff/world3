document.addEventListener('DOMContentLoaded', () => {
    const ROW_LENGTHS = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    const VERTICAL_WORD_LEFT  = 'ОТГАДЫВАЙТЕ';
    const VERTICAL_WORD_RIGHT = 'УДИВЛЯЙТЕСЬ';
    const gameBoard = document.getElementById('game-board');

    let isIframe = false;
    let rebusId = null;
    let isRebusSolved = false;
    let hasStarted = false;

    function sendToParent(message) {
        if (isIframe && window.parent) {
            window.parent.postMessage(message, "*");
        }
    }

    window.addEventListener("message", (event) => {
        const { type, rebusId: id, solved, progress } = event.data || {};
        if (type !== "rebus:init") return;

        isIframe = true;
        rebusId = id;
        isRebusSolved = solved;

        if (isRebusSolved) {
            // If already solved, show the victory modal but hide restart button
            initGame();

            // Mark all rows as dummy solved if we don't have progress
            if (!progress) {
                // Just to make it look somewhat done or we just leave it empty and show modal
            } else {
                restoreProgress(progress);
            }

            const modal = document.getElementById('victory-modal');
            modal.classList.remove('hidden');
            document.getElementById('restart-btn').style.display = 'none';
            return;
        }

        if (progress) {
            initGame();
            restoreProgress(progress);
        } else {
            initGame();
        }
    });

    function restoreProgress(progressArr) {
        if (!Array.isArray(progressArr)) return;

        progressArr.forEach((word, rowIndex) => {
            if (word) {
                const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
                if (rowContainer) {
                    const wordRow = rowContainer.querySelector('.word-row');
                    const inputs = Array.from(wordRow.querySelectorAll('.cell'));

                    for (let i = 0; i < word.length; i++) {
                        if (i < inputs.length) {
                            inputs[i].value = word[i];
                        }
                    }
                    setRowSuccess(rowIndex);
                }
            }
        });
    }

    function initGame() {
        gameBoard.innerHTML = '';
        ROW_LENGTHS.forEach((length, rowIndex) => {
            const rowContainer = document.createElement('div');
            rowContainer.className = 'row-container';
            rowContainer.dataset.index = rowIndex;

            const wordRow = document.createElement('div');
            wordRow.className = 'word-row';

            for (let i = 0; i < length; i++) {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'cell';
                input.maxLength = 1;
                input.autocomplete = 'off';
                input.spellcheck = false;
                input.dataset.row = rowIndex;
                input.dataset.col = i;

                if (i === 0) {
                    input.value = VERTICAL_WORD_LEFT[rowIndex];
                    input.classList.add('locked');
                    input.readOnly = true;
                    input.tabIndex = -1;
                } else if (i === length - 1) {
                    input.value = VERTICAL_WORD_RIGHT[rowIndex];
                    input.classList.add('locked');
                    input.readOnly = true;
                    input.tabIndex = -1;
                } else {
                    input.addEventListener('focus', () => input.select());
                    input.addEventListener('click', () => input.select());
                }

                input.addEventListener('keydown', handleKeyDown);
                input.addEventListener('input', handleInput);

                wordRow.appendChild(input);
            }

            const errorMsg = document.createElement('span');
            errorMsg.className = 'error-msg';

            const clearBtn = document.createElement('button');
            clearBtn.className = 'clear-btn';
            clearBtn.innerHTML = '✖';
            clearBtn.title = 'Очистить строку';
            clearBtn.addEventListener('click', () => clearRow(rowIndex));

            rowContainer.appendChild(wordRow);
            rowContainer.appendChild(clearBtn);
            rowContainer.appendChild(errorMsg);
            
            // Adjust margin bottom to make space for absolute positioned error message
            rowContainer.style.marginBottom = '20px';

            gameBoard.appendChild(rowContainer);
        });
    }

    function handleKeyDown(e) {
        const input = e.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        const wordRow = input.closest('.word-row');
        const inputs = Array.from(wordRow.querySelectorAll('.cell'));

        if (e.key === 'Backspace') {
            if (input.value === '' && col > 0) {
                e.preventDefault();
                let prevCol = col - 1;
                while (prevCol >= 0 && inputs[prevCol].classList.contains('locked')) prevCol--;
                if (prevCol >= 0) {
                    inputs[prevCol].focus();
                    inputs[prevCol].value = '';
                }
            }
            clearRowError(row);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            let target = col - 1;
            while (target >= 0 && inputs[target].classList.contains('locked')) target--;
            if (target >= 0) inputs[target].focus();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            let target = col + 1;
            while (target < inputs.length && inputs[target].classList.contains('locked')) target++;
            if (target < inputs.length) inputs[target].focus();
        }
    }

    function handleInput(e) {
        if (!hasStarted) {
            hasStarted = true;
            sendToParent({ type: "rebus:started" });
        }

        const input = e.target;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);
        const wordRow = input.closest('.word-row');
        const inputs = Array.from(wordRow.querySelectorAll('.cell'));

        clearRowError(row);

        // Allow only Cyrillic characters
        if (!/^[а-яА-ЯёЁ]$/.test(input.value)) {
            input.value = '';
            return;
        }

        input.value = input.value.toUpperCase();

        // Auto-advance, skipping locked cells
        let nextCol = col + 1;
        while (nextCol < inputs.length && inputs[nextCol].classList.contains('locked')) nextCol++;

        if (nextCol < inputs.length) {
            inputs[nextCol].focus();
        } else {
            validateRow(row);
        }
    }

    function clearRow(rowIndex) {
        const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
        const wordRow = rowContainer.querySelector('.word-row');
        const inputs = Array.from(wordRow.querySelectorAll('.cell'));

        inputs.forEach(input => {
            if (!input.classList.contains('locked')) {
                input.value = '';
            }
        });

        clearRowError(rowIndex);
        inputs[1].focus();
    }

    function clearRowError(rowIndex) {
        const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
        const wordRow = rowContainer.querySelector('.word-row');
        
        if (wordRow.classList.contains('success')) {
            return; // Don't clear if already successful
        }
        
        rowContainer.classList.remove('has-error');
        wordRow.classList.remove('error');
        const errorMsg = rowContainer.querySelector('.error-msg');
        errorMsg.textContent = '';
    }

    async function validateRow(rowIndex) {
        const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
        const wordRow = rowContainer.querySelector('.word-row');
        const inputs = Array.from(wordRow.querySelectorAll('.cell'));
        
        // Ensure all cells in the row are filled
        if (inputs.some(input => input.value === '')) {
            return;
        }

        const word = inputs.map(input => input.value).join('');
        
        // 1. Uniqueness check
        const successfulRows = Array.from(gameBoard.querySelectorAll('.word-row.success'));
        const isDuplicate = successfulRows.some(row => {
            const rowInputs = Array.from(row.querySelectorAll('.cell'));
            const rowWord = rowInputs.map(i => i.value).join('');
            // Comparing ignoring e/yo distinction
            return rowWord.replace(/Ё/g, 'Е') === word.replace(/Ё/g, 'Е');
        });

        if (isDuplicate) {
            showError(rowIndex, 'Это слово уже было введено.');
            return;
        }

        // Disable inputs while checking
        inputs.forEach(input => {
            if (!input.classList.contains('locked')) {
                input.readOnly = true;
            }
        });

        try {
            const apiKey = 'dict.1.1.20260425T205910Z.482931a18dd57c37.dae0fe79479b85289222943424c7314b6e708522';
            const response = await fetch(`https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=${apiKey}&lang=ru-ru&text=${encodeURIComponent(word)}`);
            const data = await response.json();

            if (!data.def || data.def.length === 0) {
                showError(rowIndex, 'Слово не найдено в словаре.');
                reEnableInputs(inputs);
                return;
            }

            // Look for a noun entry where text matches the word (case-insensitive, E/Yo invariant)
            const isValidNoun = data.def.some(entry => {
                if (entry.pos === 'noun') {
                    const entryText = entry.text.toUpperCase().replace(/Ё/g, 'Е');
                    const inputWord = word.toUpperCase().replace(/Ё/g, 'Е');
                    return entryText === inputWord;
                }
                return false;
            });

            if (!isValidNoun) {
                showError(rowIndex, 'Это не существительное в начальной форме.');
                reEnableInputs(inputs);
                return;
            }

            // Success!
            setRowSuccess(rowIndex);
            
            // Send progress
            sendProgress();

            // Check win condition
            checkWinCondition();

        } catch (error) {
            console.error('API Error:', error);
            showError(rowIndex, 'Ошибка при проверке слова. Попробуйте позже.');
            reEnableInputs(inputs);
        }
    }

    function reEnableInputs(inputs) {
        inputs.forEach(input => {
            if (!input.classList.contains('locked')) {
                input.readOnly = false;
            }
        });
    }

    function showError(rowIndex, message) {
        const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
        const wordRow = rowContainer.querySelector('.word-row');
        const errorMsg = rowContainer.querySelector('.error-msg');
        
        rowContainer.classList.add('has-error');
        wordRow.classList.add('error');
        errorMsg.textContent = message;
    }

    function setRowSuccess(rowIndex) {
        const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
        const wordRow = rowContainer.querySelector('.word-row');
        const inputs = Array.from(wordRow.querySelectorAll('.cell'));
        
        wordRow.classList.remove('error');
        rowContainer.classList.remove('has-error');
        wordRow.classList.add('success');
        
        inputs.forEach(input => {
            input.classList.add('locked');
            input.readOnly = true;
            input.tabIndex = -1; // Remove from tab order
        });
    }

    function sendProgress() {
        if (!isIframe) return;

        const progressArr = ROW_LENGTHS.map((_, rowIndex) => {
            const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
            if (!rowContainer) return null;

            const wordRow = rowContainer.querySelector('.word-row');
            if (wordRow.classList.contains('success')) {
                const inputs = Array.from(wordRow.querySelectorAll('.cell'));
                return inputs.map(input => input.value).join('');
            }
            return null;
        });

        sendToParent({
            type: "rebus:progress",
            data: progressArr
        });
    }

    function checkWinCondition() {
        const successfulRows = document.querySelectorAll('.word-row.success');
        if (successfulRows.length === ROW_LENGTHS.length) {
            if (!isRebusSolved) {
                isRebusSolved = true;
                sendToParent({ type: "rebus:solved" });
            }
            const modal = document.getElementById('victory-modal');
            modal.classList.remove('hidden');

            if (isIframe) {
                document.getElementById('restart-btn').style.display = 'none';
            }
        }
    }

    document.getElementById('restart-btn').addEventListener('click', () => {
        const modal = document.getElementById('victory-modal');
        modal.classList.add('hidden');
        initGame();
    });

    // Initial load for non-iframe context
    // If it's in iframe, initGame will be called when rebus:init is received
    setTimeout(() => {
        if (!isIframe) {
            initGame();
        }
    }, 100); // Small delay to wait for postMessage if it's an iframe
});

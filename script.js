document.addEventListener('DOMContentLoaded', () => {
    const ROW_LENGTHS = [2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2];
    const gameBoard = document.getElementById('game-board');

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
                input.dataset.row = rowIndex;
                input.dataset.col = i;

                if (i === 0) {
                    input.value = 'У';
                    input.classList.add('locked');
                    input.readOnly = true;
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
            if (input.value === '' && col > 1) {
                e.preventDefault();
                inputs[col - 1].focus();
                inputs[col - 1].value = '';
            }
            clearRowError(row); // Clear error state on edit
        } else if (e.key === 'ArrowLeft' && col > 1) {
            e.preventDefault();
            inputs[col - 1].focus();
        } else if (e.key === 'ArrowRight' && col < inputs.length - 1) {
            e.preventDefault();
            inputs[col + 1].focus();
        }
    }

    function handleInput(e) {
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

        // Auto-advance
        if (col < inputs.length - 1) {
            inputs[col + 1].focus();
        } else {
            // Trigger validation if it's the last cell
            validateRow(row);
        }
    }

    function clearRow(rowIndex) {
        const rowContainer = gameBoard.querySelector(`.row-container[data-index="${rowIndex}"]`);
        const wordRow = rowContainer.querySelector('.word-row');
        const inputs = Array.from(wordRow.querySelectorAll('.cell'));
        
        inputs.forEach((input, index) => {
            if (index > 0) {
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

    function checkWinCondition() {
        const successfulRows = document.querySelectorAll('.word-row.success');
        if (successfulRows.length === ROW_LENGTHS.length) {
            const modal = document.getElementById('victory-modal');
            modal.classList.remove('hidden');
        }
    }

    document.getElementById('restart-btn').addEventListener('click', () => {
        const modal = document.getElementById('victory-modal');
        modal.classList.add('hidden');
        initGame();
    });

    initGame();
});

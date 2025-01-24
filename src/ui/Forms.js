export const addNodeTexts = ['Add Value', 'Add Goal', 'Add Dependency', 'Add Desire'];

export function createMenuBar() {
    return $(`
        <div class="menu-bar">
            <button class="menu-button cycle-text" data-form="addNode">${addNodeTexts[0]}</button>
            <button class="menu-button" data-form="revealQR">Add Contributor</button>
        </div>
    `);
}

export function createPopupForms() {
    return $(`
        <div class="node-popup">
            <div class="node-popup-content">
                <!-- Add Node Form -->
                <form id="addNodeForm" class="popup-form">
                    <h2>Add New Node</h2>
                    <div class="form-group">
                        <label for="nodeName">Name:</label>
                        <input type="text" id="nodeName" required>
                    </div>
                    <div id="percentageGroup" class="form-group" style="display: none;">
                        <label for="nodePercentage">Desired Percentage:</label>
                        <input type="range" id="nodePercentage" min="1" max="100" value="10">
                        <output for="nodePercentage">10%</output>
                    </div>
                    <div class="form-buttons">
                        <button type="submit" class="primary">Add Node</button>
                        <button type="button" class="cancel">Cancel</button>
                    </div>
                </form>

                <!-- Reveal QR Form -->
                <form id="revealQRForm" class="popup-form" style="display: none;">
                    <h2>Your Public Key</h2>
                    <div class="qr-display">
                        <div id="qr-code"></div>
                        <div id="public-key-text"></div>
                    </div>
                    <div class="form-buttons">
                        <button type="button" class="copy-key">Copy Key</button>
                        <button type="button" class="cancel">Close</button>
                    </div>
                </form>
            </div>
        </div>
    `);
} 
class Keyboard {
    constructor(opts) {
        if (!opts.layout || !opts.container) throw "Missing options";

        let ctrlseq = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
        let layout = JSON.parse(require("fs").readFileSync(opts.layout, {encoding: "utf-8"}));
        let container = document.getElementById(opts.container);

        // Set default keyboard properties
        container.dataset.isShiftOn = false;
        container.dataset.isCapsLckOn = false;
        container.dataset.isAltOn = false;
        container.dataset.isCtrlOn = false;
        container.dataset.isFnOn = false;

        // Parse keymap and create DOM
        Object.keys(layout).forEach((row) => {
            container.innerHTML += `<div class="keyboard_row" id="`+row+`"></div>`;
            layout[row].forEach((keyObj) => {
                let key = document.createElement("div");
                key.setAttribute("class", "keyboard_key");

                if (keyObj.cmd === " ") {
                    key.setAttribute("id", "keyboard_spacebar");
                } else if (keyObj.cmd === "\r") {
                    key.setAttribute("class", "keyboard_key keyboard_enter");
                    key.innerHTML = `<h1>${keyObj.name}</h1>`;
                } else {
                    key.innerHTML = `
                        <h4>${keyObj.fn_name || ""}</h4>
                        <h3>${keyObj.alt_name || ""}</h3>
                        <h2>${keyObj.shift_name || ""}</h2>
                        <h1>${keyObj.name || ""}</h1>`;
                }

                Object.keys(keyObj).forEach((property) => {
                    let i = 1;
                    while(i <= ctrlseq.length) {
                        keyObj[property] = keyObj[property].replace("~~~CTRLSEQ"+i+"~~~", ctrlseq[i]);
                        i++;
                    }
                    if (property.endsWith("cmd")) {
                        key.dataset[property] = keyObj[property];
                    }
                });

                document.getElementById(row).appendChild(key);
            });
        });

        // Apply click (and/or touch) handler functions (write to socket and animations)
        let pressKey = (key) => {
            let cmd = key.dataset.cmd || "";
            if (container.dataset.isShiftOn === "true" && key.dataset.shift_cmd || container.dataset.isCapsLckOn === "true" && key.dataset.shift_cmd) cmd = key.dataset.shift_cmd;
            if (container.dataset.isCtrlOn === "true" && key.dataset.ctrl_cmd) cmd = key.dataset.ctrl_cmd;
            if (container.dataset.isAltOn === "true" && key.dataset.alt_cmd) cmd = key.dataset.alt_cmd;
            if (container.dataset.isFnOn === "true" && key.dataset.fn_cmd) cmd = key.dataset.fn_cmd;

            if (cmd.startsWith("ESCAPED|-- ")) {
                cmd = cmd.substr(11);
                switch(cmd) {
                    case "CAPSLCK: ON":
                        container.dataset.isCapsLckOn = "true";
                        break;
                    case "CAPSLCK: OFF":
                        container.dataset.isCapsLckOn = "false";
                        break;
                    case "FN: ON":
                        container.dataset.isFnOn = "true";
                        break;
                    case "FN: OFF":
                        container.dataset.isFnOn = "false";
                        break;
                }
            } else {
                term.socket.send(cmd);
            }
        };

        container.childNodes.forEach((row) => {
            row.childNodes.forEach((key) => {

                let enterElements = document.querySelectorAll(".keyboard_enter");

                if (key.attributes["class"].value.endsWith("keyboard_enter")) {
                    // The enter key is divided in two dom elements, so we bind their animations here

                    key.onmousedown = (e) => {
                        pressKey(key);
                        key.holdTimeout = setTimeout(() => {
                            key.holdInterval = setInterval(() => {
                                pressKey(key);
                            }, 70);
                        }, 400);

                        enterElements.forEach((key) => {
                            key.setAttribute("class", "keyboard_key active keyboard_enter");
                        });

                        // Keep focus on the terminal
                        term.term.focus();
                        e.preventDefault();
                    };
                    key.onmouseup = () => {
                        clearTimeout(key.holdTimeout);
                        clearInterval(key.holdInterval);

                        enterElements.forEach((key) => {
                            key.setAttribute("class", "keyboard_key blink keyboard_enter");
                        });
                        setTimeout(() => {
                            enterElements.forEach((key) => {
                                key.setAttribute("class", "keyboard_key keyboard_enter");
                            });
                        }, 100);
                    };
                } else {
                    key.onmousedown = (e) => {
                        if (key.dataset.cmd.startsWith("ESCAPED|-- ")) {
                            let cmd = key.dataset.cmd.substr(11);
                            if (cmd.startsWith("CTRL")) {
                                container.dataset.isCtrlOn = "true";
                            }
                            if (cmd.startsWith("SHIFT")) {
                                container.dataset.isShiftOn = "true";
                            }
                            if (cmd.startsWith("ALT")) {
                                container.dataset.isAltOn = "true";
                            }
                        } else {
                            key.holdTimeout = setTimeout(() => {
                                key.holdInterval = setInterval(() => {
                                    pressKey(key);
                                }, 70);
                            }, 400);
                        }
                        pressKey(key);

                        // Keep focus on the terminal
                        term.term.focus();
                        e.preventDefault();
                    };
                    key.onmouseup = (e) => {
                        if (key.dataset.cmd.startsWith("ESCAPED|-- ")) {
                            let cmd = key.dataset.cmd.substr(11);
                            if (cmd.startsWith("CTRL")) {
                                container.dataset.isCtrlOn = "false";
                            }
                            if (cmd.startsWith("SHIFT")) {
                                container.dataset.isShiftOn = "false";
                            }
                            if (cmd.startsWith("ALT")) {
                                container.dataset.isAltOn = "false";
                            }
                        } else {
                            clearTimeout(key.holdTimeout);
                            clearInterval(key.holdInterval);
                        }

                        key.setAttribute("class", "keyboard_key blink");
                        setTimeout(() => {
                            key.setAttribute("class", "keyboard_key");
                        }, 100);
                    };
                }
            });
        });

        // Bind actual keyboard actions to on-screen animations (for use without a touchscreen)
        let findKey = (e) => {
            // Find basic keys (typically letters, upper and lower-case)
            let key = document.querySelector('div.keyboard_key[data-cmd="'+e.key+'"]');
            if (key === null) key = document.querySelector('div.keyboard_key[data-shift_cmd="'+e.key+'"]');

            // Find special keys (shift, control, arrows, etc.)
            if (key === null && e.code === "ShiftLeft") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- SHIFT: LEFT"]');
            if (key === null && e.code === "ShiftRight") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- SHIFT: RIGHT"]');
            if (key === null && e.code === "ControlLeft") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- CTRL: LEFT"]');
            if (key === null && e.code === "ControlRight") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- CTRL: RIGHT"]');
            if (key === null && e.code === "AltLeft") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- FN: ON"]');
            if (key === null && e.code === "AltRight") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- ALT: RIGHT"]');
            if (key === null && e.code === "CapsLock") key = document.querySelector('div.keyboard_key[data-cmd="ESCAPED|-- CAPSLCK: ON"]');
            if (key === null && e.code === "Escape") key = document.querySelector('div.keyboard_key[data-cmd=""]');
            if (key === null && e.code === "Backspace") key = document.querySelector('div.keyboard_key[data-cmd=""]');
            if (key === null && e.code === "ArrowUp") key = document.querySelector('div.keyboard_key[data-cmd="OA"]');
            if (key === null && e.code === "ArrowLeft") key = document.querySelector('div.keyboard_key[data-cmd="OD"]');
            if (key === null && e.code === "ArrowDown") key = document.querySelector('div.keyboard_key[data-cmd="OB"]');
            if (key === null && e.code === "ArrowRight") key = document.querySelector('div.keyboard_key[data-cmd="OC"]');
            if (key === null && e.code === "Enter") key = document.querySelectorAll('div.keyboard_key.keyboard_enter');

            // Find "rare" keys (ctrl and alt symbols)
            if (key === null) key = document.querySelector('div.keyboard_key[data-ctrl_cmd="'+e.key+'"]');
            if (key === null) key = document.querySelector('div.keyboard_key[data-alt_cmd="'+e.key+'"]');

            return key;
        };

        document.onkeydown = (e) => {
            let key = findKey(e);
            if (key === null) return;
            if (key.length) {
                key.forEach((enterElement) => {
                    enterElement.setAttribute("class", "keyboard_key active keyboard_enter");
                });
            } else {
                key.setAttribute("class", "keyboard_key active");
            }
        }

        document.onkeyup = (e) => {
            let key = findKey(e);
            if (key === null) return;
            if (key.length) {
                key.forEach((enterElement) => {
                    enterElement.setAttribute("class", "keyboard_key blink keyboard_enter");
                });
                setTimeout(() => {
                    key.forEach((enterElement) => {
                        enterElement.setAttribute("class", "keyboard_key keyboard_enter");
                    });
                }, 100);
            } else {
                key.setAttribute("class", "keyboard_key blink");
                setTimeout(() => {
                    key.setAttribute("class", "keyboard_key");
                }, 100);
            }
        }
    }
}

module.exports = {
    Keyboard
};

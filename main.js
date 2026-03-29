/**
 * AERO-G1 · Hybrid XR Vision System
 * main.js · v4.1.0 · Premium Logic Refinement
 */

'use strict';

const state = {
    diagnosticActive: false,
    helmetPlaced: false,
    xrLaunched: false,
    cameraActive: false,
    cameraStream: null,
};

const $ = id => document.getElementById(id);

/* ─────────────────────────────────────────────────────────────
   CAMERA MANAGER (Pseudo-AR Fallback)
───────────────────────────────────────────────────────────── */
const CameraManager = (() => {
    let _videoEl = null;

    function _buildDOM() {
        if (!$('cam-bg')) {
            _videoEl = document.createElement('video');
            _videoEl.id = 'cam-bg';
            _videoEl.setAttribute('autoplay', '');
            _videoEl.setAttribute('playsinline', '');
            _videoEl.setAttribute('muted', '');
            document.body.insertBefore(_videoEl, document.body.firstChild);
        } else { _videoEl = $('cam-bg'); }
    }

    return {
        async request() {
            _buildDOM();
            return this.start();
        },
        async start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                state.cameraStream = stream;
                state.cameraActive = true;
                _videoEl.srcObject = stream;
                _videoEl.classList.add('cam-visible');
                document.body.classList.add('cam-active');
                _setSceneAlpha(true);
                InterfaceManager.showToast('LIVE CAMERA FEED ACTIVE');
                return true;
            } catch (e) {
                console.error('[Camera] Access denied:', e);
                InterfaceManager.showToast('CAMERA ERROR: ACCESS DENIED');
                return false;
            }
        },
        stop() {
            if (state.cameraStream) state.cameraStream.getTracks().forEach(t => t.stop());
            state.cameraStream = null;
            state.cameraActive = false;
            if (_videoEl) _videoEl.classList.remove('cam-visible');
            document.body.classList.remove('cam-active');
            _setSceneAlpha(false);
        }
    };
})();

/* ─────────────────────────────────────────────────────────────
   INTERFACE MANAGER (Hybrid Dual-Mode)
───────────────────────────────────────────────────────────── */
window.InterfaceManager = (() => {
    return {
        async launch(mode) {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');
            const modeLabel = $('xr-mode-label');

            if (!xrScene) return;

            // 1. UI Preparation
            if (hero) hero.style.display = 'none';
            xrScene.style.display = 'block';
            xrControls.style.display = 'flex';

            const isAR = mode === 'ar';
            if (modeLabel) modeLabel.textContent = isAR ? 'MODE: AUGMENTED REALITY' : 'MODE: VIRTUAL GALLERY';
            
            _setSceneAlpha(isAR);
            this.startTelemetry();

            // 2. Request Session
            if (navigator.xr && isAR) {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-ar');
                    if (supported) {
                        this.showToast('SCAN OVER THE FLOOR FOR PLACEMENT');
                        xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native AR check failed:', e); }
            }

            if (navigator.xr && mode === 'vr') {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (supported) {
                        xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native VR check failed:', e); }
            }

            // 3. Fallback
            if (isAR) {
                this.showToast('NATIVE XR UNAVAILABLE - CAMERA MODE ACTIVE');
                CameraManager.request();
            }
        },

        exit() {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');

            if (!xrScene) return;

            xrScene.style.display = 'none';
            xrControls.style.display = 'none';
            if (hero) hero.style.display = 'flex';

            if (state.cameraActive) CameraManager.stop();
            if (xrScene.exitVR) xrScene.exitVR();
            
            this.stopTelemetry();
            window.dispatchEvent(new Event('resize'));
        },

        startTelemetry() {
            const track = $('ticker-inner');
            if (!track) return;
            const items = [
                'CORE TEMP: 32°C [STABLE]',
                'XR LATENCY: 2.1 MS',
                'SIGNAL: 100% [ENCRYPTED]',
                'SENSORS: ACTIVE [6DOF]',
                'AERO-G1 SYSTEM: OK',
                'BATTERY: 98% [NOMINAL]'
            ];
            track.innerHTML = items.map(t => `<span class="ticker-item">${t}</span>`).join('');
            document.body.classList.add('ticker-active');
        },

        stopTelemetry() {
            document.body.classList.remove('ticker-active');
        },

        showToast(msg) {
            let toast = $('xr-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'xr-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('visible');
            setTimeout(() => toast.classList.remove('visible'), 5000);
        }
    };
})();

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function _setSceneAlpha(on) {
    const xrScene = $('xr-scene');
    const env = $('environment');
    if (!xrScene) return;

    if (on) document.body.classList.add('cam-active');
    else document.body.classList.remove('cam-active');

    if (env) {
        env.setAttribute('visible', String(!on));
        env.setAttribute('environment', `active: ${!on}`);
    }

    const canvas = xrScene.querySelector('canvas');
    if (canvas) {
        canvas.style.backgroundColor = on ? 'transparent' : '#03030a';
        canvas.style.setProperty('background', on ? 'transparent' : '#03030a', 'important');
    }
}

/* ─────────────────────────────────────────────────────────────
   INITIALIZATION
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const xrScene = $('xr-scene');
    if (!xrScene) return;

    // Button Bindings
    if ($('launch-ar')) $('launch-ar').onclick = () => window.InterfaceManager.launch('ar');
    if ($('launch-vr')) $('launch-vr').onclick = () => window.InterfaceManager.launch('vr');
    if ($('exit-xr')) $('exit-xr').onclick = () => window.InterfaceManager.exit();
    
    if ($('toggle-diagnostic')) {
        $('toggle-diagnostic').onclick = () => {
            state.diagnosticActive = !state.diagnosticActive;
            $('toggle-diagnostic').classList.toggle('active', state.diagnosticActive);
            InterfaceManager.showToast('DIAGNOSTIC MODE: ' + (state.diagnosticActive ? 'ON' : 'OFF'));
        };
    }
});

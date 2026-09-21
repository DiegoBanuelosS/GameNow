// GameNow Installer Logic & Cinematic Transitions
document.addEventListener('DOMContentLoaded', () => {
  const stepWelcome = document.getElementById('step-welcome');
  const stepLocation = document.getElementById('step-location');
  const stepProgress = document.getElementById('step-progress');

  const btnContinue = document.getElementById('btn-continue');
  const btnBack = document.getElementById('btn-back');
  const btnInstall = document.getElementById('btn-install');
  const btnBrowse = document.getElementById('btn-browse');
  const btnFinish = document.getElementById('btn-finish');

  const pathInput = document.getElementById('install-path');
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');
  const progressStatus = document.getElementById('progress-status');
  const progressTitle = document.getElementById('progress-title');
  const progressCheckmark = document.getElementById('progress-checkmark');
  const progressActions = document.getElementById('progress-actions');

  const installerWindow = document.querySelector('.installer-window');
  const logo = document.getElementById('installer-logo');

  let isTransitioning = false;
  let progressInterval = null;

  function switchStep(fromStep, toStep) {
    if (!fromStep || !toStep || isTransitioning) return;
    isTransitioning = true;

    const isHidingHero = toStep.id === 'step-location' || toStep.id === 'step-progress';

    // 1. Destello reactivo cinemático en el logo
    if (logo) {
      logo.classList.remove('glint');
      void logo.offsetWidth; // Forzar reflow
      logo.classList.add('glint');
    }

    // 2. Salida animada escalonada del paso actual
    fromStep.classList.remove('animate-in');
    fromStep.classList.add('animate-out');
    fromStep.setAttribute('aria-hidden', 'true');

    // 3. Colapsar o restaurar la imagen superior (hero banner)
    if (installerWindow) {
      if (isHidingHero) {
        installerWindow.classList.add('hide-hero');
      } else {
        installerWindow.classList.remove('hide-hero');
      }
    }

    // 4. Entrada del nuevo paso con efecto cascada
    setTimeout(() => {
      fromStep.classList.remove('active', 'animate-out');
      fromStep.style.display = 'none';

      toStep.style.display = 'flex';
      toStep.classList.remove('animate-out');
      toStep.classList.add('active', 'animate-in');
      toStep.removeAttribute('aria-hidden');

      const input = toStep.querySelector('input');
      if (input) {
        setTimeout(() => {
          input.focus();
        }, 360);
      }

      setTimeout(() => {
        isTransitioning = false;
      }, 500);
    }, 280);
  }

  // Simulación realista del proceso de instalación
  function runInstallSimulation() {
    let percent = 0;
    if (progressInterval) clearInterval(progressInterval);

    // Resetear estados visuales
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    progressStatus.textContent = 'Preparando espacio y archivos...';
    progressTitle.textContent = 'Instalando GameNow...';
    if (progressCheckmark) progressCheckmark.classList.remove('visible');
    progressActions.style.display = 'none';

    const stages = [
      { at: 15, text: 'Verificando permisos y creando directorios...' },
      { at: 35, text: 'Extrayendo paquetes de recursos y texturas...' },
      { at: 55, text: 'Copiando ejecutables del sistema...' },
      { at: 75, text: 'Instalando dependencias y librerías...' },
      { at: 90, text: 'Configurando el servicio en segundo plano...' },
      { at: 98, text: 'Creando accesos directos en el escritorio...' },
      { at: 100, text: 'Todo listo para jugar.' }
    ];

    progressInterval = setInterval(() => {
      // Avance orgánico con pequeñas variaciones
      const stepSpeed = Math.floor(Math.random() * 3) + 1;
      percent = Math.min(100, percent + stepSpeed);

      progressBar.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;

      const currentStage = stages.find((s) => percent <= s.at);
      if (currentStage) {
        progressStatus.textContent = currentStage.text;
      }

      if (percent >= 100) {
        clearInterval(progressInterval);
        progressTitle.textContent = 'GameNow ya está instalado';
        if (progressCheckmark) progressCheckmark.classList.add('visible');
        progressStatus.textContent = 'Instalación completada con éxito.';

        setTimeout(() => {
          progressActions.style.display = 'flex';
        }, 400);
      }
    }, 85);
  }

  // API pública para conectar con instaladores reales (WebView2 / Flutter / CLI)
  window.setInstallProgress = function (percentage, statusText) {
    const clamped = Math.min(100, Math.max(0, percentage));
    if (progressBar) progressBar.style.width = `${clamped}%`;
    if (progressPercent) progressPercent.textContent = `${Math.round(clamped)}%`;
    if (statusText && progressStatus) progressStatus.textContent = statusText;

    if (clamped >= 100) {
      if (progressTitle) progressTitle.textContent = 'GameNow ya está instalado';
      if (progressCheckmark) progressCheckmark.classList.add('visible');
      if (progressActions) progressActions.style.display = 'flex';
    }
  };

  // Event Listeners de navegación
  if (btnContinue && stepWelcome && stepLocation) {
    btnContinue.addEventListener('click', () => {
      switchStep(stepWelcome, stepLocation);
    });
  }

  if (btnBack && stepWelcome && stepLocation) {
    btnBack.addEventListener('click', () => {
      switchStep(stepLocation, stepWelcome);
    });
  }

  if (btnInstall && stepLocation && stepProgress) {
    btnInstall.addEventListener('click', () => {
      switchStep(stepLocation, stepProgress);
      setTimeout(runInstallSimulation, 320);
    });
  }

  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      btnFinish.textContent = 'Abriendo GameNow...';
      btnFinish.style.opacity = '0.7';
      btnFinish.style.pointerEvents = 'none';
      setTimeout(() => {
        alert('¡GameNow se ha abierto con éxito!');
      }, 500);
    });
  }

  // Explorador de carpetas / Selector de directorio
  if (btnBrowse && pathInput) {
    btnBrowse.addEventListener('click', async () => {
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          if (dirHandle && dirHandle.name) {
            pathInput.value = `C:\\${dirHandle.name}\\GameNow`;
          }
        } catch (_) {
          // El usuario canceló la selección
        }
      } else {
        const newPath = prompt(
          'Introduce la ruta donde quieres instalar GameNow:',
          pathInput.value
        );
        if (newPath && newPath.trim()) {
          pathInput.value = newPath.trim();
        }
      }
    });
  }
});

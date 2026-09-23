using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace GameNow.Installer {
    public static class Logger {
        public static void Log(string msg) {
            try {
                string logPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "gamenow_installer.log");
                using (var fs = new FileStream(logPath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
                using (var sw = new StreamWriter(fs)) {
                    sw.WriteLine(DateTime.Now.ToString("HH:mm:ss.fff") + " " + msg);
                }
            } catch { }
        }
    }

    public class App : Application {
        [STAThread]
        public static void Main() {
            AppDomain.CurrentDomain.UnhandledException += (s, e) => {
                Logger.Log("APPDOMAIN UNHANDLED: " + e.ExceptionObject);
                MessageBox.Show("Error fatal:\n\n" + e.ExceptionObject);
            };

            try {
                Logger.Log("Main: starting App");
                var app = new App();
                app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
                app.Exit += (s, e) => {
                    Logger.Log("App: Exit event fired, code=" + e.ApplicationExitCode);
                };
                app.DispatcherUnhandledException += (s, e) => {
                    Logger.Log("DISPATCHER UNHANDLED: " + e.Exception);
                    MessageBox.Show("Error en interfaz:\n\n" + e.Exception.Message);
                    e.Handled = true;
                };

                Logger.Log("Main: constructing MainWindow");
                var window = new MainWindow();
                app.MainWindow = window;
                Logger.Log("Main: calling window.Show()");
                window.Show();
                Logger.Log("Main: calling app.Run()");
                app.Run();
                Logger.Log("Main: App.Run returned cleanly");
            } catch (Exception ex) {
                Logger.Log("MAIN CATCH: " + ex);
                MessageBox.Show("Error iniciando el instalador de GameNow:\n\n" + ex.Message);
            }
        }
    }

    public class MainWindow : Window {
        // UI Layout
        private Grid _rootGrid;
        private Grid _step1Grid;
        private Grid _step2Grid;
        private Grid _step3Grid;

        // Step 2 controls
        private TextBox _pathInput;
        private CheckBox _desktopShortcutCheck;

        // Step 3 controls
        private TextBlock _statusText;
        private TextBlock _subStatusText;
        private Border _progressTrack;
        private Border _progressBar;
        private Viewbox _checkmarkViewbox;
        private Button _openButton;
        private TextBlock _step3Title;

        // State
        private string _targetDirectory;
        private bool _isInstalling = false;

        public MainWindow() {
            Logger.Log("MainWindow: ctor start");
            Title = "GameNow - Instalador";
            Width = 1085;
            Height = 710;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            AllowsTransparency = false;
            Background = new SolidColorBrush(Color.FromRgb(5, 5, 5));
            ResizeMode = ResizeMode.NoResize;

            _targetDirectory = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "GameNow");

            Logger.Log("MainWindow: calling BuildUI");
            BuildUI();
            Logger.Log("MainWindow: BuildUI returned");

            Closing += (s, e) => {
                Logger.Log("MainWindow: Closing event fired, Cancel=" + e.Cancel);
            };
            Closed += (s, e) => {
                Logger.Log("MainWindow: Closed event fired");
            };
        }

        private ImageSource LoadEmbeddedImage(string resourceName) {
            try {
                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream(resourceName)) {
                    if (stream != null) {
                        var bi = new BitmapImage();
                        bi.BeginInit();
                        bi.CacheOption = BitmapCacheOption.OnLoad;
                        bi.StreamSource = stream;
                        bi.EndInit();
                        bi.Freeze();
                        return bi;
                    }
                }
            } catch (Exception ex) {
                Logger.Log("LoadEmbeddedImage(" + resourceName + ") error: " + ex.Message);
            }

            // Fallback to disk
            try {
                var localPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", resourceName);
                if (File.Exists(localPath)) {
                    var bi = new BitmapImage(new Uri(localPath));
                    bi.Freeze();
                    return bi;
                }
            } catch { }

            return null;
        }

        private void BuildUI() {
            try {
                Logger.Log("BuildUI: create mainBorder");
                var mainBorder = new Border {
                    Background = new SolidColorBrush(Color.FromRgb(0, 0, 0)),
                    BorderBrush = new SolidColorBrush(Color.FromArgb(35, 255, 255, 255)),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(12),
                    ClipToBounds = true
                };

                _rootGrid = new Grid { Background = new SolidColorBrush(Color.FromRgb(0, 0, 0)) };
                mainBorder.Child = _rootGrid;
                Content = mainBorder;

                // Ambient background aura
                var aura = new RadialGradientBrush {
                    Center = new Point(0.5, 0.45),
                    GradientOrigin = new Point(0.5, 0.45),
                    RadiusX = 0.5,
                    RadiusY = 0.5
                };
                aura.GradientStops.Add(new GradientStop(Color.FromArgb(12, 255, 255, 255), 0));
                aura.GradientStops.Add(new GradientStop(Color.FromArgb(4, 255, 255, 255), 0.45));
                aura.GradientStops.Add(new GradientStop(Colors.Transparent, 0.8));
                var auraRect = new Rectangle { Fill = aura, IsHitTestVisible = false };
                _rootGrid.Children.Add(auraRect);

                Logger.Log("BuildUI: BuildStep1");
                BuildStep1();

                Logger.Log("BuildUI: BuildStep2");
                BuildStep2();

                Logger.Log("BuildUI: BuildStep3");
                BuildStep3();

                Logger.Log("BuildUI: BuildTopBar");
                BuildTopBar();

                _step1Grid.Visibility = Visibility.Visible;
                _step2Grid.Visibility = Visibility.Collapsed;
                _step3Grid.Visibility = Visibility.Collapsed;
                Logger.Log("BuildUI: completed successfully");
            } catch (Exception ex) {
                Logger.Log("BuildUI caught: " + ex);
                throw;
            }
        }

        private void BuildTopBar() {
            var topBar = new Grid {
                Height = 48,
                VerticalAlignment = VerticalAlignment.Top,
                Background = Brushes.Transparent
            };
            topBar.MouseLeftButtonDown += (s, e) => {
                if (e.ButtonState == MouseButtonState.Pressed) {
                    DragMove();
                }
            };

            // Window Controls (Minimize, Close) at top right
            var controlsPanel = new StackPanel {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Top
            };

            var btnMin = new Button {
                Content = new TextBlock { Text = "—", FontSize = 12, Foreground = Brushes.White, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center },
                Width = 46,
                Height = 44,
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            btnMin.MouseEnter += (s, e) => btnMin.Background = new SolidColorBrush(Color.FromArgb(30, 255, 255, 255));
            btnMin.MouseLeave += (s, e) => btnMin.Background = Brushes.Transparent;
            btnMin.Click += (s, e) => WindowState = WindowState.Minimized;
            controlsPanel.Children.Add(btnMin);

            var btnClose = new Button {
                Content = new TextBlock { Text = "✕", FontSize = 13, Foreground = Brushes.White, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center },
                Width = 46,
                Height = 44,
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            btnClose.MouseEnter += (s, e) => btnClose.Background = new SolidColorBrush(Color.FromRgb(232, 17, 35));
            btnClose.MouseLeave += (s, e) => btnClose.Background = Brushes.Transparent;
            btnClose.Click += (s, e) => {
                Close();
                try { Application.Current.Shutdown(); } catch { }
            };
            controlsPanel.Children.Add(btnClose);

            topBar.Children.Add(controlsPanel);
            _rootGrid.Children.Add(topBar);
        }

        private void BuildStep1() {
            _step1Grid = new Grid();

            // 1. Hero Banner Container (Height = 320, Top, ClipToBounds)
            var bannerContainer = new Grid {
                Height = 320,
                VerticalAlignment = VerticalAlignment.Top,
                ClipToBounds = true,
                Background = new SolidColorBrush(Color.FromRgb(0, 0, 0))
            };
            bannerContainer.MouseLeftButtonDown += (s, e) => {
                if (e.ButtonState == MouseButtonState.Pressed) {
                    DragMove();
                }
            };

            var heroSource = LoadEmbeddedImage("header.png");
            if (heroSource != null) {
                var heroImg = new Image {
                    Source = heroSource,
                    Width = 1085,
                    Height = 723,
                    Stretch = Stretch.UniformToFill,
                    VerticalAlignment = VerticalAlignment.Top,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, -75, 0, 0),
                    IsHitTestVisible = false
                };
                RenderOptions.SetBitmapScalingMode(heroImg, BitmapScalingMode.HighQuality);
                bannerContainer.Children.Add(heroImg);

                // Top shade for controls contrast
                var topShade = new Rectangle {
                    Height = 120,
                    VerticalAlignment = VerticalAlignment.Top,
                    Fill = new LinearGradientBrush(
                        Color.FromArgb(190, 0, 0, 0),
                        Colors.Transparent,
                        new Point(0, 0),
                        new Point(0, 1)),
                    IsHitTestVisible = false
                };
                bannerContainer.Children.Add(topShade);

                // Bottom fade to pure black (hero-fade matching original design)
                var bottomFade = new Rectangle {
                    Height = 180,
                    VerticalAlignment = VerticalAlignment.Bottom,
                    Fill = new LinearGradientBrush {
                        StartPoint = new Point(0, 0),
                        EndPoint = new Point(0, 1),
                        GradientStops = new GradientStopCollection {
                            new GradientStop(Colors.Transparent, 0.0),
                            new GradientStop(Color.FromArgb(0x22, 0, 0, 0), 0.35),
                            new GradientStop(Color.FromArgb(0x88, 0, 0, 0), 0.65),
                            new GradientStop(Color.FromArgb(0xDF, 0, 0, 0), 0.85),
                            new GradientStop(Color.FromRgb(0, 0, 0), 1.0)
                        }
                    },
                    IsHitTestVisible = false
                };
                bannerContainer.Children.Add(bottomFade);
            }

            // GAMENOW Logo (Centered over the hero banner, matching Image 2)
            var logoSource = LoadEmbeddedImage("logo.png");
            if (logoSource != null) {
                var logoImg = new Image {
                    Source = logoSource,
                    Height = 28,
                    Stretch = Stretch.Uniform,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Top,
                    Margin = new Thickness(0, 68, 0, 0),
                    IsHitTestVisible = false
                };
                RenderOptions.SetBitmapScalingMode(logoImg, BitmapScalingMode.HighQuality);
                bannerContainer.Children.Add(logoImg);
            }

            _step1Grid.Children.Add(bannerContainer);

            // 2. Step 1 content (Positioned cleanly below banner with zero subtitle, matching Image 2)
            var contentPanel = new StackPanel {
                VerticalAlignment = VerticalAlignment.Top,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 345, 0, 0)
            };

            var title = new TextBlock {
                Text = "Todos Tus Juegos En Un Solo Lugar",
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 28,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(240, 240, 240)),
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 24)
            };
            contentPanel.Children.Add(title);

            // Continuar Button (pill button, white background, black text)
            var btnContinue = new Button {
                Content = new TextBlock {
                    Text = "Continuar",
                    FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                    FontSize = 14,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = Brushes.Black
                },
                Width = 176,
                Height = 42,
                Background = Brushes.White,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };

            var btnTemplate = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.Name = "BtnBorder";
            borderFactory.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(10));
            var cpFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            cpFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            cpFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(cpFactory);
            btnTemplate.VisualTree = borderFactory;

            var trigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            trigger.Setters.Add(new Setter(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(225, 225, 225)), "BtnBorder"));
            btnTemplate.Triggers.Add(trigger);
            btnContinue.Template = btnTemplate;

            btnContinue.Click += (s, e) => TransitionToStep2();
            contentPanel.Children.Add(btnContinue);

            _step1Grid.Children.Add(contentPanel);
            _rootGrid.Children.Add(_step1Grid);
        }

        private void BuildStep2() {
            _step2Grid = new Grid {
                Margin = new Thickness(60, 60, 60, 60),
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center
            };

            var panel = new StackPanel {
                Width = 600,
                HorizontalAlignment = HorizontalAlignment.Center
            };

            // Title
            var title = new TextBlock {
                Text = "¿Dónde quieres instalar GameNow?",
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 28,
                FontWeight = FontWeights.SemiBold,
                Foreground = new SolidColorBrush(Color.FromRgb(236, 231, 222)),
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 12)
            };
            panel.Children.Add(title);

            var subtitle = new TextBlock {
                Text = "Elige la carpeta donde se copiarán los archivos y ejecutables.",
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 14,
                Foreground = new SolidColorBrush(Color.FromRgb(156, 149, 136)),
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 36)
            };
            panel.Children.Add(subtitle);

            // Path input + Browse button container
            var inputBorder = new Border {
                Background = new SolidColorBrush(Color.FromRgb(26, 24, 21)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(46, 43, 38)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(14),
                Padding = new Thickness(14, 4, 10, 4),
                Margin = new Thickness(0, 0, 0, 20)
            };

            var pathGrid = new Grid();
            pathGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            pathGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            _pathInput = new TextBox {
                Text = _targetDirectory,
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 14,
                Foreground = new SolidColorBrush(Color.FromRgb(236, 231, 222)),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                VerticalAlignment = VerticalAlignment.Center,
                Padding = new Thickness(4, 10, 4, 10)
            };
            Grid.SetColumn(_pathInput, 0);
            pathGrid.Children.Add(_pathInput);

            var btnBrowse = new Button {
                Content = new TextBlock {
                    Text = "Examinar",
                    FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                    FontSize = 13,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = new SolidColorBrush(Color.FromRgb(236, 231, 222))
                },
                Height = 36,
                Padding = new Thickness(16, 0, 16, 0),
                Background = new SolidColorBrush(Color.FromRgb(34, 31, 27)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(46, 43, 38)),
                BorderThickness = new Thickness(1),
                Cursor = Cursors.Hand,
                VerticalAlignment = VerticalAlignment.Center
            };
            var browseTemplate = new ControlTemplate(typeof(Button));
            var bBrdFactory = new FrameworkElementFactory(typeof(Border));
            bBrdFactory.Name = "Brd";
            bBrdFactory.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            bBrdFactory.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Button.BorderBrushProperty));
            bBrdFactory.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Button.BorderThicknessProperty));
            bBrdFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(8));
            var bCpFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            bCpFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            bCpFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            bBrdFactory.AppendChild(bCpFactory);
            browseTemplate.VisualTree = bBrdFactory;
            var bTrig = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            bTrig.Setters.Add(new Setter(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(45, 41, 36)), "Brd"));
            browseTemplate.Triggers.Add(bTrig);
            btnBrowse.Template = browseTemplate;

            btnBrowse.Click += (s, e) => {
                using (var dialog = new System.Windows.Forms.FolderBrowserDialog()) {
                    dialog.Description = "Selecciona la carpeta donde deseas instalar GameNow";
                    dialog.SelectedPath = _pathInput.Text;
                    if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK) {
                        _pathInput.Text = dialog.SelectedPath;
                    }
                }
            };
            Grid.SetColumn(btnBrowse, 1);
            pathGrid.Children.Add(btnBrowse);

            inputBorder.Child = pathGrid;
            panel.Children.Add(inputBorder);

            // Desktop shortcut checkbox
            _desktopShortcutCheck = new CheckBox {
                IsChecked = true,
                Content = new TextBlock {
                    Text = "Poner GameNow en el escritorio",
                    FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                    FontSize = 14,
                    Foreground = new SolidColorBrush(Color.FromRgb(156, 149, 136)),
                    VerticalAlignment = VerticalAlignment.Center
                },
                Margin = new Thickness(4, 0, 0, 36),
                Cursor = Cursors.Hand
            };
            panel.Children.Add(_desktopShortcutCheck);

            // Actions row: Atrás and Instalar
            var actionsRow = new StackPanel {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Center
            };

            var btnBack = new Button {
                Content = new TextBlock {
                    Text = "Atrás",
                    FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                    FontSize = 15,
                    FontWeight = FontWeights.Medium,
                    Foreground = new SolidColorBrush(Color.FromRgb(156, 149, 136))
                },
                Height = 44,
                Padding = new Thickness(24, 0, 24, 0),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                Margin = new Thickness(0, 0, 16, 0)
            };
            btnBack.Click += (s, e) => TransitionBackToStep1();
            actionsRow.Children.Add(btnBack);

            var btnInstall = new Button {
                Content = new TextBlock {
                    Text = "Instalar",
                    FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                    FontSize = 15,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = Brushes.Black
                },
                Width = 180,
                Height = 44,
                Background = Brushes.White,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            var instTemplate = new ControlTemplate(typeof(Button));
            var instBorder = new FrameworkElementFactory(typeof(Border));
            instBorder.Name = "InstBrd";
            instBorder.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            instBorder.SetValue(Border.CornerRadiusProperty, new CornerRadius(10));
            var instCp = new FrameworkElementFactory(typeof(ContentPresenter));
            instCp.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            instCp.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            instBorder.AppendChild(instCp);
            instTemplate.VisualTree = instBorder;
            var instTrig = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            instTrig.Setters.Add(new Setter(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(225, 225, 225)), "InstBrd"));
            instTemplate.Triggers.Add(instTrig);
            btnInstall.Template = instTemplate;

            btnInstall.Click += (s, e) => StartInstallation();
            actionsRow.Children.Add(btnInstall);

            panel.Children.Add(actionsRow);

            _step2Grid.Children.Add(panel);
            _rootGrid.Children.Add(_step2Grid);
        }

        private void BuildStep3() {
            _step3Grid = new Grid {
                Margin = new Thickness(60, 80, 60, 60),
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Center
            };

            var panel = new StackPanel {
                Width = 520,
                HorizontalAlignment = HorizontalAlignment.Center
            };

            // White Checkmark Icon (Initially hidden)
            _checkmarkViewbox = new Viewbox {
                Width = 64,
                Height = 64,
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 24),
                Visibility = Visibility.Collapsed
            };
            var checkmarkPath = new System.Windows.Shapes.Path {
                Data = Geometry.Parse("M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"),
                Fill = Brushes.White,
                Stretch = Stretch.Uniform
            };
            _checkmarkViewbox.Child = checkmarkPath;
            panel.Children.Add(_checkmarkViewbox);

            // Step 3 Title
            _step3Title = new TextBlock {
                Text = "Instalando GameNow...",
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 26,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 12)
            };
            panel.Children.Add(_step3Title);

            // Status message
            _statusText = new TextBlock {
                Text = "Preparando instalación...",
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 14,
                Foreground = new SolidColorBrush(Color.FromRgb(170, 170, 170)),
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 28)
            };
            panel.Children.Add(_statusText);

            // Minimalist Progress Bar (No glow, clean white track)
            _progressTrack = new Border {
                Height = 6,
                Background = new SolidColorBrush(Color.FromRgb(35, 35, 35)),
                CornerRadius = new CornerRadius(3),
                ClipToBounds = true,
                Margin = new Thickness(0, 0, 0, 16)
            };
            _progressBar = new Border {
                Height = 6,
                Width = 0,
                HorizontalAlignment = HorizontalAlignment.Left,
                Background = Brushes.White,
                CornerRadius = new CornerRadius(3)
            };
            _progressTrack.Child = _progressBar;
            panel.Children.Add(_progressTrack);

            // Sub-status (MB / percentage)
            _subStatusText = new TextBlock {
                Text = "0%",
                FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                FontSize = 12,
                Foreground = new SolidColorBrush(Color.FromRgb(120, 120, 120)),
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 36)
            };
            panel.Children.Add(_subStatusText);

            // "Abrir GameNow" launcher button (Initially hidden)
            _openButton = new Button {
                Content = new TextBlock {
                    Text = "Abrir GameNow",
                    FontFamily = new FontFamily("Sora, Segoe UI, sans-serif"),
                    FontSize = 15,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = Brushes.Black
                },
                Width = 240,
                Height = 52,
                Background = Brushes.White,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                HorizontalAlignment = HorizontalAlignment.Center,
                Visibility = Visibility.Collapsed
            };
            var openTemplate = new ControlTemplate(typeof(Button));
            var openBrd = new FrameworkElementFactory(typeof(Border));
            openBrd.Name = "OpenBrd";
            openBrd.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            openBrd.SetValue(Border.CornerRadiusProperty, new CornerRadius(12));
            var openCp = new FrameworkElementFactory(typeof(ContentPresenter));
            openCp.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            openCp.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            openBrd.AppendChild(openCp);
            openTemplate.VisualTree = openBrd;
            var openTrig = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            openTrig.Setters.Add(new Setter(Border.BackgroundProperty, new SolidColorBrush(Color.FromRgb(230, 230, 230)), "OpenBrd"));
            openTemplate.Triggers.Add(openTrig);
            _openButton.Template = openTemplate;

            _openButton.Click += (s, e) => LaunchGameNowAndExit();
            panel.Children.Add(_openButton);

            _step3Grid.Children.Add(panel);
            _rootGrid.Children.Add(_step3Grid);
        }

        private void TransitionToStep2() {
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(200));
            fadeOut.Completed += (s, e) => {
                _step1Grid.Visibility = Visibility.Collapsed;
                _step2Grid.Visibility = Visibility.Visible;
                var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250));
                _step2Grid.BeginAnimation(UIElement.OpacityProperty, fadeIn);
            };
            _step1Grid.BeginAnimation(UIElement.OpacityProperty, fadeOut);
        }

        private void TransitionBackToStep1() {
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(200));
            fadeOut.Completed += (s, e) => {
                _step2Grid.Visibility = Visibility.Collapsed;
                _step1Grid.Visibility = Visibility.Visible;
                var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250));
                _step1Grid.BeginAnimation(UIElement.OpacityProperty, fadeIn);
            };
            _step2Grid.BeginAnimation(UIElement.OpacityProperty, fadeOut);
        }

        private void StartInstallation() {
            if (_isInstalling) return;
            _isInstalling = true;

            _targetDirectory = _pathInput.Text.Trim();
            if (string.IsNullOrEmpty(_targetDirectory)) {
                _targetDirectory = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Programs", "GameNow");
            }

            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(200));
            fadeOut.Completed += (s, e) => {
                _step2Grid.Visibility = Visibility.Collapsed;
                _step3Grid.Visibility = Visibility.Visible;
                var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(250));
                _step3Grid.BeginAnimation(UIElement.OpacityProperty, fadeIn);
                RunInstallProcessAsync();
            };
            _step2Grid.BeginAnimation(UIElement.OpacityProperty, fadeOut);
        }

        private void UpdateProgress(double fraction, string status, string subStatus) {
            Dispatcher.Invoke(() => {
                _progressBar.Width = Math.Max(0, Math.Min(520, fraction * 520));
                if (status != null) _statusText.Text = status;
                if (subStatus != null) _subStatusText.Text = subStatus;
            });
        }

        private async void RunInstallProcessAsync() {
            await Task.Run(() => {
                try {
                    UpdateProgress(0.05, "Descargando paquete de GameNow...", "Conectando...");

                    // 1. Obtain package zip (either via API or local fallback)
                    string zipTempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "GameNow-Package.zip");
                    bool downloaded = false;

                    // Try downloading from local API server
                    try {
                        using (var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) }) {
                            var url = "http://127.0.0.1:8787/api/download/app";
                            var response = client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead).Result;
                            if (response.IsSuccessStatusCode) {
                                var totalBytes = response.Content.Headers.ContentLength ?? 11300000;
                                using (var stream = response.Content.ReadAsStreamAsync().Result)
                                using (var fs = new FileStream(zipTempPath, FileMode.Create, FileAccess.Write, FileShare.None)) {
                                    byte[] buffer = new byte[65536];
                                    long received = 0;
                                    int read;
                                    while ((read = stream.Read(buffer, 0, buffer.Length)) > 0) {
                                        fs.Write(buffer, 0, read);
                                        received += read;
                                        double frac = 0.05 + ((double)received / totalBytes) * 0.65;
                                        double recMb = (double)received / 1048576.0;
                                        double totMb = (double)totalBytes / 1048576.0;
                                        UpdateProgress(frac,
                                            string.Format("Descargando GameNow ({0:0.0} MB / {1:0.0} MB)...", recMb, totMb),
                                            string.Format("{0:0}%", (frac * 100)));
                                    }
                                }
                                downloaded = true;
                            }
                        }
                    } catch { }

                    // Fallback to embedded or local zip
                    if (!downloaded) {
                        UpdateProgress(0.40, "Extrayendo paquete...", "40%");
                        var asm = Assembly.GetExecutingAssembly();
                        using (var stream = asm.GetManifestResourceStream("payload.zip")) {
                            if (stream != null) {
                                using (var fs = new FileStream(zipTempPath, FileMode.Create, FileAccess.Write)) {
                                    stream.CopyTo(fs);
                                }
                                downloaded = true;
                            }
                        }
                    }

                    if (!downloaded) {
                        // Check local assets
                        var candidates = new[] {
                            System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "payload.zip"),
                            System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "GameNow-Windows.zip"),
                            @"c:\Users\Diego\OneDrive\Documentos\GitHub\GameNow\SETUP\assets\payload.zip",
                            @"c:\Users\Diego\OneDrive\Documentos\GitHub\GameNow\SETUP\assets\GameNow-Windows.zip"
                        };
                        foreach (var c in candidates) {
                            if (File.Exists(c)) {
                                File.Copy(c, zipTempPath, true);
                                downloaded = true;
                                break;
                            }
                        }
                    }

                    // 2. Extract into target directory
                    UpdateProgress(0.75, "Instalando archivos en tu equipo...", "75%");
                    if (!Directory.Exists(_targetDirectory)) {
                        Directory.CreateDirectory(_targetDirectory);
                    }

                    if (File.Exists(zipTempPath)) {
                        using (var zip = ZipFile.OpenRead(zipTempPath)) {
                            int totalEntries = zip.Entries.Count;
                            int current = 0;
                            foreach (var entry in zip.Entries) {
                                current++;
                                if (string.IsNullOrEmpty(entry.Name)) continue; // Directory
                                string destFile = System.IO.Path.Combine(_targetDirectory, entry.FullName);
                                string destDir = System.IO.Path.GetDirectoryName(destFile);
                                if (!Directory.Exists(destDir)) Directory.CreateDirectory(destDir);
                                entry.ExtractToFile(destFile, true);

                                double frac = 0.75 + ((double)current / totalEntries) * 0.15;
                                UpdateProgress(frac, "Instalando: " + entry.Name, string.Format("{0:0}%", frac * 100));
                            }
                        }
                        try { File.Delete(zipTempPath); } catch { }
                    }

                    // 3. Shortcuts
                    UpdateProgress(0.95, "Creando accesos directos...", "95%");
                    string exePath = System.IO.Path.Combine(_targetDirectory, "gamenow.exe");
                    if (!File.Exists(exePath)) {
                        // Look for any .exe in target dir
                        var exes = Directory.GetFiles(_targetDirectory, "*.exe", SearchOption.AllDirectories);
                        if (exes.Length > 0) exePath = exes[0];
                    }

                    bool createDesktop = false;
                    Dispatcher.Invoke(() => { createDesktop = _desktopShortcutCheck.IsChecked == true; });

                    if (createDesktop && File.Exists(exePath)) {
                        try {
                            string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                            string linkPath = System.IO.Path.Combine(desktopPath, "GameNow.lnk");
                            CreateShortcut(exePath, linkPath);
                        } catch { }
                    }

                    // Start menu shortcut
                    try {
                        string startMenuPath = System.IO.Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                            "Programs", "GameNow.lnk");
                        CreateShortcut(exePath, startMenuPath);
                    } catch { }

                    UpdateProgress(0.98, "Registrando GameNow en Windows...", "98%");
                    if (File.Exists(exePath)) {
                        RegisterInstalledApp(_targetDirectory, exePath);
                    }

                    // 4. Completed!
                    UpdateProgress(1.0, "Listo", "100%");
                    System.Threading.Thread.Sleep(400);

                    Dispatcher.Invoke(() => {
                        ShowCompletionUI();
                    });
                } catch (Exception ex) {
                    Dispatcher.Invoke(() => {
                        _step3Title.Text = "Error durante la instalación";
                        _statusText.Text = ex.Message;
                        _subStatusText.Text = "";
                    });
                }
            });
        }

        private void ShowCompletionUI() {
            _step3Title.Text = "GameNow ya está en tu PC";
            _statusText.Text = "La instalación se completó con éxito.";
            _subStatusText.Visibility = Visibility.Collapsed;
            _progressTrack.Visibility = Visibility.Collapsed;

            // Animated pop-in white checkmark
            _checkmarkViewbox.Visibility = Visibility.Visible;
            _checkmarkViewbox.RenderTransformOrigin = new Point(0.5, 0.5);
            var scaleTrans = new ScaleTransform(0, 0);
            _checkmarkViewbox.RenderTransform = scaleTrans;

            var scaleAnim = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(400)) {
                EasingFunction = new BackEase { Amplitude = 0.5, EasingMode = EasingMode.EaseOut }
            };
            scaleTrans.BeginAnimation(ScaleTransform.ScaleXProperty, scaleAnim);
            scaleTrans.BeginAnimation(ScaleTransform.ScaleYProperty, scaleAnim);

            _openButton.Visibility = Visibility.Visible;
            var btnFade = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(300));
            _openButton.BeginAnimation(UIElement.OpacityProperty, btnFade);
        }

        private void LaunchGameNowAndExit() {
            try {
                string exePath = System.IO.Path.Combine(_targetDirectory, "gamenow.exe");
                if (File.Exists(exePath)) {
                    Process.Start(new ProcessStartInfo {
                        FileName = exePath,
                        WorkingDirectory = _targetDirectory
                    });
                }
            } catch { }
            Close();
            try { Application.Current.Shutdown(); } catch { }
        }

        private static void RegisterInstalledApp(string appDir, string exePath) {
            string uninstallCmd = System.IO.Path.Combine(appDir, "uninstall.cmd");
            string script =
                "@echo off\r\n" +
                "taskkill /F /IM gamenow.exe >nul 2>&1\r\n" +
                "reg delete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameNow\" /f >nul 2>&1\r\n" +
                "powershell -NoProfile -Command \"$d = [Environment]::GetFolderPath('Desktop'); if ($d) { Remove-Item (Join-Path $d 'GameNow.lnk') -Force -ErrorAction SilentlyContinue }; $p = [Environment]::GetFolderPath('Programs'); if ($p) { Remove-Item (Join-Path $p 'GameNow.lnk') -Force -ErrorAction SilentlyContinue }\"\r\n" +
                "start \"\" /min cmd /c \"ping 127.0.0.1 -n 3 >nul & rmdir /s /q \\\"" + appDir + "\\\"\"\r\n";
            File.WriteAllText(uninstallCmd, script);

            long bytes = 0;
            try {
                foreach (var file in Directory.GetFiles(appDir, "*", SearchOption.AllDirectories)) {
                    bytes += new FileInfo(file).Length;
                }
            } catch { }
            int sizeKb = (int)Math.Max(1, bytes / 1024);
            string uninstall = "cmd.exe /c \"" + uninstallCmd + "\"";

            using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\GameNow")) {
                key.SetValue("DisplayName", "GameNow");
                key.SetValue("DisplayVersion", "1.0.0");
                key.SetValue("Publisher", "GameNow");
                key.SetValue("InstallLocation", appDir);
                key.SetValue("DisplayIcon", exePath + ",0");
                key.SetValue("UninstallString", uninstall);
                key.SetValue("QuietUninstallString", uninstall);
                key.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
                key.SetValue("EstimatedSize", sizeKb, RegistryValueKind.DWord);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("Language", 1034, RegistryValueKind.DWord);
            }
        }

        private static void CreateShortcut(string targetPath, string shortcutPath) {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            dynamic shell = Activator.CreateInstance(shellType);
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = targetPath;
            shortcut.WorkingDirectory = System.IO.Path.GetDirectoryName(targetPath);
            shortcut.WindowStyle = 1;
            shortcut.Description = "GameNow - the core of gaming";
            shortcut.Save();
        }
    }
}

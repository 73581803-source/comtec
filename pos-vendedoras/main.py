"""Bootstrap del POS ComTec.
Ejecuta:  python main.py
"""
import sys
from pathlib import Path
from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QIcon

import api
from theme import STYLESHEET
from login_window import LoginWindow
from main_window import MainWindow


class App(QApplication):
    def __init__(self, argv):
        super().__init__(argv)
        self.setApplicationName("ComTec POS")
        self.setOrganizationName("ComTec")
        icon_path = Path(__file__).parent / "assets" / "logo.jpeg"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))
        self.setStyleSheet(STYLESHEET)
        self.login = None
        self.main  = None
        self._show_login()

    def _show_login(self):
        if self.main:
            self.main.close()
            self.main = None
        self.login = LoginWindow()
        self.login.login_ok.connect(self._on_login_ok)
        self.login.show()

    def _on_login_ok(self, user):
        self.login.close()
        self.main = MainWindow()
        self.main.logout_requested.connect(self._show_login)
        self.main.show()


def main():
    app = App(sys.argv)
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

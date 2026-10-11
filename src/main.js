import './styles.css';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';

try {
  const canvas = document.querySelector('#game-canvas');
  const uiRoot = document.querySelector('#game-ui');
  if (!canvas || !uiRoot) throw new Error('缺少游戏画布或界面容器。');

  const game = new Game({ canvas });
  const ui = new UIManager({ root: uiRoot, game });
  game.attachUIManager(ui);
  game.start();
} catch (error) {
  const message = document.createElement('p');
  message.className = 'startup-error';
  message.setAttribute('role', 'alert');
  message.textContent = '游戏启动失败：' + error.message;
  document.body.append(message);
  const app = document.querySelector('#app');
  if (app) app.hidden = true;
  console.error(error);
}

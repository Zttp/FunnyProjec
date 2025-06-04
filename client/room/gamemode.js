import { Vector3 } from 'pixel_combats/basic';
import { Game, Players, Teams, Bots, Chat, Spawns, Timers, Properties } from 'pixel_combats/room';

// Глобальные переменные
const gameMode = {
    playerBots: new Map(), // Связь игроков с их ботами
    botSkins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Доступные скины для ботов
    botWeapons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Доступные оружия для ботов
};

// Инициализация чат-команд
function initChatCommands() {
    Chat.OnMessage.Add(function(m) {
        const msg = m.Text.trim();
        const sender = Players.GetByRoomId(m.Sender);
        if (!sender) return;

        const args = msg.split(' ');
        const command = args[0].toLowerCase();

        if (command === '/help') {
            sender.Ui.Hint.Value = `Доступные команды:
/bot [skinId] [weaponId] - создать бота
/aye - управлять ботом
/botstop - перестать управлять ботом
/botlist - список ваших ботов
/botkill [id] - удалить бота
/tp [x] [y] [z] - телепортироваться`;
        }
        
        else if (command === '/bot') {
            // Проверяем, не имеет ли игрок уже слишком много ботов
            if (getPlayerBotsCount(sender.id) >= 3) {
                sender.Ui.Hint.Value = "У вас уже максимальное количество ботов (3)!";
                return;
            }
            
            let skinId = 0;
            let weaponId = 0;
            
            // Парсим аргументы
            if (args.length >= 2) {
                skinId = parseInt(args[1]);
                if (isNaN(skinId)) skinId = 0;
                skinId = Math.max(0, Math.min(skinId, gameMode.botSkins.length - 1));
            }
            
            if (args.length >= 3) {
                weaponId = parseInt(args[2]);
                if (isNaN(weaponId)) weaponId = 0;
                weaponId = Math.max(0, Math.min(weaponId, gameMode.botWeapons.length - 1));
            }
            
            // Создаем бота
            const bot = createBot(sender, skinId, weaponId);
            if (bot) {
                sender.Ui.Hint.Value = `Бот создан! ID: ${bot.Id}`;
            } else {
                sender.Ui.Hint.Value = "Ошибка при создании бота!";
            }
        }
        
        else if (command === '/aye') {
            // Находим первого живого бота игрока
            const bots = getPlayerBots(sender.id);
            const aliveBot = bots.find(b => b.Alive);
            
            if (!aliveBot) {
                sender.Ui.Hint.Value = "У вас нет живых ботов! Создайте бота командой /bot";
                return;
            }
            
            // Начинаем управление ботом
            startBotControl(sender, aliveBot);
            sender.Ui.Hint.Value = `Вы теперь управляете ботом ID: ${aliveBot.Id}`;
        }
        
        else if (command === '/botstop') {
            // Прекращаем управление ботом
            stopBotControl(sender);
            sender.Ui.Hint.Value = "Вы перестали управлять ботом";
        }
        
        else if (command === '/botlist') {
            // Показываем список ботов игрока
            const bots = getPlayerBots(sender.id);
            if (bots.length === 0) {
                sender.Ui.Hint.Value = "У вас нет ботов!";
                return;
            }
            
            let botList = "Ваши боты:\n";
            bots.forEach(bot => {
                botList += `ID: ${bot.Id} | Скин: ${bot.SkinId} | Оружие: ${bot.WeaponId} | ${bot.Alive ? "Жив" : "Мертв"}\n`;
            });
            
            sender.Ui.Hint.Value = botList;
        }
        
        else if (command === '/botkill') {
            if (args.length < 2) {
                sender.Ui.Hint.Value = "Использование: /botkill [id]";
                return;
            }
            
            const botId = parseInt(args[1]);
            if (isNaN(botId)) {
                sender.Ui.Hint.Value = "Некорректный ID бота!";
                return;
            }
            
            // Удаляем бота
            const success = destroyPlayerBot(sender.id, botId);
            if (success) {
                sender.Ui.Hint.Value = `Бот ID: ${botId} удален!`;
            } else {
                sender.Ui.Hint.Value = `Бот ID: ${botId} не найден или не принадлежит вам!`;
            }
        }
        
        else if (command === '/tp') {
            if (args.length < 4) {
                sender.Ui.Hint.Value = "Использование: /tp [x] [y] [z]";
                return;
            }
            
            const x = parseFloat(args[1]);
            const y = parseFloat(args[2]);
            const z = parseFloat(args[3]);
            
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                sender.Ui.Hint.Value = "Некорректные координаты!";
                return;
            }
            
            sender.SetPositionAndRotation(new Vector3(x, y, z), sender.Rotation);
            sender.Ui.Hint.Value = `Телепортирован в (${x}, ${y}, ${z})`;
        }
    });
}

// Создает бота для игрока
function createBot(player, skinId, weaponId) {
    const spawnPos = getRandomSpawnPosition();
    
    const spawnData = {
        Position: spawnPos,
        Rotation: new Vector2(0, 0),
        WeaponId: weaponId,
        SkinId: skinId,
        LookAt: null
    };
    
    const bot = Bots.CreateHuman(spawnData);
    if (!bot) return null;
    
    // Сохраняем связь бота с игроком
    if (!gameMode.playerBots.has(player.id)) {
        gameMode.playerBots.set(player.id, []);
    }
    gameMode.playerBots.get(player.id).push(bot);
    
    return bot;
}

// Возвращает случайную позицию спавна
function getRandomSpawnPosition() {
    const index = Math.floor(Math.random() * gameMode.spawnPoints.length);
    return gameMode.spawnPoints[index];
}

// Уничтожает бота игрока
function destroyPlayerBot(playerId, botId) {
    if (!gameMode.playerBots.has(playerId)) return false;
    
    const bots = gameMode.playerBots.get(playerId);
    const botIndex = bots.findIndex(b => b.Id === botId);
    
    if (botIndex === -1) return false;
    
    const bot = bots[botIndex];
    bot.Destroy();
    bots.splice(botIndex, 1);
    
    return true;
}

// Получает всех ботов игрока
function getPlayerBots(playerId) {
    return gameMode.playerBots.get(playerId) || [];
}

// Получает количество ботов игрока
function getPlayerBotsCount(playerId) {
    return getPlayerBots(playerId).length;
}

// Начинает управление ботом
function startBotControl(player, bot) {
    // Останавливаем предыдущее управление, если было
    stopBotControl(player);
    
    // Сохраняем текущее управление
    player.Properties.Get('ControlledBot').Value = bot.Id;
    
    // Создаем таймер для синхронизации позиции
    const controlTimer = Timers.GetContext(player).Get("BotControl");
    controlTimer.OnTimer.Add(() => {
        if (!bot || !bot.Alive) {
            stopBotControl(player);
            return;
        }
        
        // Синхронизируем позицию, поворот и направление взгляда
        bot.SetPositionAndDirection(
            player.Position,
            player.Controls.LookDirection.Value
        );
        
        // Синхронизируем атаку
        bot.Attack = player.Controls.Attack.Value;
    });
    
    controlTimer.RestartLoop(0.05); // 20 раз в секунду
}

// Прекращает управление ботом
function stopBotControl(player) {
    player.Properties.Get('ControlledBot').Value = 0;
    const controlTimer = Timers.GetContext(player).Get("BotControl");
    if (controlTimer) controlTimer.Stop();
}

// Обработчик события смерти бота
function setupBotEventHandlers() {
    Bots.OnBotDeath.Add(function(data) {
        // Находим игрока, которому принадлежал бот
        for (const [playerId, bots] of gameMode.playerBots) {
            const botIndex = bots.findIndex(b => b.Id === data.Bot.Id);
            if (botIndex !== -1) {
                const player = Players.Get(playerId);
                if (player) {
                    player.Ui.Hint.Value = `Ваш бот ID: ${data.Bot.Id} был убит!`;
                }
                
                // Удаляем бота из списка
                bots.splice(botIndex, 1);
                break;
            }
        }
    });
    
    Bots.OnBotRemove.Add(function(bot) {
        // Удаляем бота из списков игроков
        for (const [playerId, bots] of gameMode.playerBots) {
            const botIndex = bots.findIndex(b => b.Id === bot.Id);
            if (botIndex !== -1) {
                bots.splice(botIndex, 1);
                break;
            }
        }
    });
}


// Обработка смены команды
function setupTeamChangeHandler() {
    Teams.OnPlayerChangeTeam.Add(function(player) { 
        player.Spawns.Spawn();
    });
}

// Инициализация режима
function initGameMode() {
    // Создаем команду "Игроки"
    const playersTeam = Game.Teams.Add('Players', 'Игроки', new Color(0.2, 0.6, 1, 1));
    playersTeam.Spawns.SpawnPointsGroups.Add(0); // Группа спавна 0
    
    
    // Инициализация команд и обработчиков
    initChatCommands();
    setupBotEventHandlers();
    setupSpawnSystem();
    setupTeamChangeHandler();
    
    // При подключении игрока - добавляем его в команду
    Players.OnPlayerConnected.Add(function(player) {
        player.Team = playersTeam;
        player.Properties.Get('ControlledBot').Value = 0;
        player.Ui.Hint.Value = 'Добро пожаловать! Используйте /help для списка команд';
        player.Spawns.Spawn();
    });
    
    // Устанавливаем стартовое сообщение
    player.Ui.Hint.Value = "Режим управления ботами! Используйте /bot для создания ботов";
}

// Запуск игры
initGameMode();

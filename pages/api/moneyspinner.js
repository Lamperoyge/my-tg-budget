import TelegramBot from 'node-telegram-bot-api';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID);


const loadSheet = async () => {
  await doc.loadInfo();
  const sheets = doc.sheetsByTitle;
  const sheet = sheets.Expenses;
  return sheet;
};

const CATEGORIES = [
  'Bills',
  'Entertainment',
  'Food & Drink',
  'Groceries',
  'Health & Wellbeing',
  'Other',
  'Shopping',
  'Transport',
  'Travel',
  'Business',
  'Investing',
  'Gifts',
  'Subscriptions',
];

const keyboard = [[]];

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
};

CATEGORIES.forEach((category, index) => {
  const lastIdx = keyboard.length - 1 > 0 ? keyboard.length - 1 : 0;
  if (keyboard[lastIdx].length < 3) {
    keyboard[lastIdx].push(category);
  } else {
    keyboard.push([category]);
  }
});

const apiToken = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(apiToken);

const Message = (() => {
  let instance = null;
  class MessageClass {
    constructor() {
      this.chatId = '';
      this.category = null;
      this.sum = 0;
      this.createdDate = new Date();
      this.updatedDate = new Date();
      this.item = '';
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new MessageClass();
      }
      return instance;
    },
    destroyInstance: () => {
      instance = null;
    },
  };
})();

const handleCreate = async (chatId, sentMessage) => {
  const message = Message.getInstance();
  if (sentMessage === 'cancel') {
    Message.destroyInstance();
    return await bot.sendMessage(chatId, 'Instance destroyed', {
      reply_markup: { remove_keyboard: true },
    });
  }
  if (!message.chatId && !message.item) {
    message.chatId = chatId;
    return await bot.sendMessage(chatId, 'Select the category', {
      reply_markup: { keyboard: keyboard },
    });
  }

  if (CATEGORIES.includes(sentMessage)) {
    message.category = sentMessage;
    return await bot.sendMessage(chatId, 'Enter the sum', {
      reply_markup: { remove_keyboard: true },
    });
  }

  if (!isNaN(parseInt(sentMessage, 10))) {
    message.sum = parseInt(sentMessage, 10);
    return await bot.sendMessage(chatId, 'Enter the description');
  }

  if (sentMessage && message.chatId && message.category && message.sum) {
    message.item = sentMessage;

    const sheet = await loadSheet();
    sheet.addRow({
      'Marcaj de timp': formatDate(message.createdDate),
      'Purchase Date': formatDate(message.updatedDate),
      Item: message.item || sentMessage,
      Amount: message.sum,
      Category: message.category,
    });
    Message.destroyInstance();
    return await bot.sendMessage(chatId, 'Thanks for your input');
  }
};

export default async function handler(req, res) {
  const chatId = req.body.message.chat.id;
  const sentMessage = req.body.message.text;
  try {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_PRIVATE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/gm, '\n'),
    });
  } catch (error) {
    console.log(error, 'error');
  }
  
  await handleCreate(chatId, sentMessage);
  res.send('ok');
}

import csvParse from 'csv-parse';

import { getRepository, In } from 'typeorm';

import fs from 'fs';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  filePath: string;
}

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ filePath }: Request): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getRepository(Transaction);

    const readCSVStream = fs.createReadStream(filePath);

    const parserStream = csvParse({
      from_line: 2,
    });

    const parseCsv = readCSVStream.pipe(parserStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCsv.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCsv.on('end', resolve));

    const groupCategoriesInCSV = categories.reduce(
      (accumulator: string[], category) => {
        const exist = accumulator.includes(category);

        if (!exist) {
          accumulator.push(category);
        }

        return accumulator;
      },
      [],
    );

    const categoriesInDatabase = await categoriesRepository.find({
      where: {
        title: In(groupCategoriesInCSV),
      },
    });

    const titleCategoriesInDatabase = categoriesInDatabase.map(
      (category: Category) => category.title,
    );

    const addCategories = groupCategoriesInCSV.filter(
      category => !titleCategoriesInDatabase.includes(category),
    );

    const createdCategories = categoriesRepository.create(
      addCategories.map(title => ({ title })),
    );

    await categoriesRepository.save(createdCategories);

    const allCategories = [...createdCategories, ...categoriesInDatabase];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;

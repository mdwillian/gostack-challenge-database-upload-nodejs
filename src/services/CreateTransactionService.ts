import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    let checkCategoryExists = await categoriesRepository.findOne({
      title: category,
    });

    if (!checkCategoryExists) {
      checkCategoryExists = categoriesRepository.create({
        title: category,
      });

      await categoriesRepository.save(checkCategoryExists);
    }

    if (type === 'outcome') {
      const { total } = await transactionsRepository.getBalance();
      const checkValueIsValid = total > value;

      if (!checkValueIsValid) {
        throw new AppError('There is not enough balance!', 400);
      }
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id: checkCategoryExists.id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;

import createHttpError from 'http-errors';
import bcrypt from 'bcrypt';
import * as UserServices from '../services/userServices.js';
import saveFileToUploadDir from '../utils/saveFileToUploadDir.js';
import saveFileToCloudinary from '../utils/saveFileToCloudinary.js';
import { env } from '../utils/env.js';
import UserCollection from '../db/models/Users.js';

const enableCloudinary = env('ENABLE_CLOUDINARY');

export const getUserByIdController = async (req, res) => {
  const { id } = req.params;
  const data = await UserServices.getUserById(id);

  if (!data) {
    throw createHttpError(404, `User not found`);
  }

  res.json({
    status: 200,
    message: `User with ${id} successfully find`,
    data,
  });
};

export const upsertUserController = async (req, res) => {
  const { id } = req.params;
  const { oldPassword, password, ...otherData } = req.body;

  if (password) {
    const user = await UserCollection.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);

    console.log('Старий пароль правильний:', isPasswordCorrect);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // Хешуємо новий пароль і додаємо до `otherData`
    otherData.password = await bcrypt.hash(password, 10);
    console.log(otherData);
  }

  const { isNew, data } = await UserServices.updateUsers(
    { _id: id },
    otherData,
    { upsert: true },
  );

  console.log('data', data);

  const status = isNew ? 201 : 200;

  res.status(status).json({
    status: status, // Ensure the status here reflects the operation
    message: 'Successfully patched a user!', // Change 'contact' to 'user'
    data,
  });
};

export const patchUserController = async (req, res) => {
  const {
    _id: id
  } = req.user;
  const avatar = req.file;

  let photoUrl;

  if (avatar) {
    if (enableCloudinary === 'true') {
      photoUrl = await saveFileToCloudinary(avatar);
    } else {
      photoUrl = await saveFileToUploadDir(avatar);
    }
  }

  const updatedData = {
    ...req.body,
    ...(photoUrl && {
      avatar: photoUrl
    }),
  };

  const result = await UserServices.updateContact(id, updatedData);

  if (!result) {
    throw createHttpError(404, `User with id=${id} not found`);
  }

  res.json({
    status: 200,
    message: 'Successfully patched the user!',
    data: result,
  });
};

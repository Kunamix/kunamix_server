import express from 'express';
import { kunamixMailSender } from '../controllers/mail.controller';

const mailRouter = express.Router();

mailRouter.post('/kunamix/mail-sender', kunamixMailSender);


export default mailRouter;
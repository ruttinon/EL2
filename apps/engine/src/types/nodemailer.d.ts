declare module 'nodemailer' {
  export type Transporter = {
    sendMail(message: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<unknown>;
  };

  export type TransportOptions = {
    host: string;
    port: number;
    secure?: boolean;
  };

  const nodemailer: {
    createTransport(options: TransportOptions): Transporter;
  };

  export default nodemailer;
}

package email

import (
	"backend/api/server"
	"fmt"

	"github.com/wneessen/go-mail"
)

type EmailInfo struct {
	From        string
	To          string
	Subject     string
	ContentType mail.ContentType
	Body        string
}

func SendEmail(email EmailInfo) error {
	client := server.Server.Mail
	if client == nil {
		msg := "email client is not initialized"
		fmt.Println(msg)
		return fmt.Errorf("%s", msg)
	}

	message := mail.NewMsg()
	if err := message.From(email.From); err != nil {
		fmt.Printf("failed to set From address: %s\n", err)
		return err
	}
	if err := message.To(email.To); err != nil {
		fmt.Printf("failed to set To address: %s\n", err)
		return err
	}
	message.Subject(email.Subject)
	message.SetBodyString(email.ContentType, email.Body)

	if err := client.DialAndSend(message); err != nil {
		fmt.Printf("failed to send mail: %s\n", err)
		return err
	}

	return nil
}

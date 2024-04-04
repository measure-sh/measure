package measure

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func PutEvent(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"ok": "ok"})
}

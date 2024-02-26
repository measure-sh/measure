package cmd

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"github.com/spf13/cobra"
)

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// The path to output directory
var outputDir string

// The port to run the server
var port string

func init() {
	recordCmd.Flags().StringVarP(&outputDir, "path", "p", "../session-data", "Path to store sessions")
	recordCmd.Flags().StringVarP(&port, "port", "P", ":8080", "Port to run the server")
	rootCmd.AddCommand(recordCmd)
}

var recordCmd = &cobra.Command{
	Use:   "record",
	Short: "Records sessions and mapping files",
	Long: `Records incoming session requests and mapping files to disk in ../session-data directory.
	
The sessions & mappings are recorded in the following structue in "session-data" directory:

+ root
- foo						# app name dir
  - 1.2.3					# app version dir
    - 04cc1c6d-853b-4926-8d04-4501965a8d5e.json	# session json file
    - 7e2f676c-8604-4dd0-b5d8-3669e333f714.json # session json file
    - mapping.txt				# mapping file
- bar						# app name dir
  - 4.5.6					# app version dir
    - e2f676c-8604-4dd0-b5d8-3669e333f714.json	# session json file
    - 55300a74-ba16-4e62-a699-0cd41f5e43c0.json	# session json file
    - mapping.txt				# mapping file`,
	Run: func(cmd *cobra.Command, args []string) {
		r := gin.Default()

		r.PUT("/sessions", func(c *gin.Context) {
			writeSession(c)
		})

		r.PUT("/mappings", func(c *gin.Context) {
			writeMapping(c)
		})
		r.Run(port)
	},
}

func writeSession(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read request body: " + err.Error()})
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	session := Session{}
	if err := c.ShouldBindJSON(&session); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unable to parse request: " + err.Error()})
		return
	}

	filePath := filepath.Join(outputDir, session.Resource.AppUniqueID, session.Resource.AppVersion, session.SessionID+".json")

	if _, err := os.Stat(filePath); err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session {session.SessionID} already exists"})
		return
	}

	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session: " + err.Error()})
		return
	}

	if err := os.WriteFile(filePath, body, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session: " + err.Error()})
		return
	}

	c.Status(http.StatusAccepted)
}

func writeMapping(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(100 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unable to parse multipart form: " + err.Error()})
		return
	}

	file, _, err := c.Request.FormFile("mapping_file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to get mapping file: " + err.Error()})
		return
	}
	defer file.Close()

	appUniqueID := c.Request.FormValue("app_unique_id")
	versionName := c.Request.FormValue("version_name")
	if appUniqueID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "app_unique_id is required"})
		return
	}
	if versionName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "version_name is required"})
		return
	}

	filePath := filepath.Join(outputDir, appUniqueID, versionName, "mapping.txt")

	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create mapping file: " + err.Error()})
		return
	}

	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create mapping file: " + err.Error()})
		return
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to write mapping file: " + err.Error()})
		return
	}

	c.Status(http.StatusAccepted)
}

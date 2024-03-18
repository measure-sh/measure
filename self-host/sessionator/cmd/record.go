package cmd

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sessionator/app"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/BurntSushi/toml"
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
	Short: "Records sessions & mappings",
	Long: `Records sessions & mappings to disk.
	
Structue of "session-data" directory once written:` + "\n" + DirTree() + "\n" + ValidNote(),
	Run: func(cmd *cobra.Command, args []string) {
		r := gin.Default()

		r.PUT("/sessions", func(c *gin.Context) {
			writeSession(c)
		})

		r.PUT("/builds", func(c *gin.Context) {
			writeBuild(c)
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

	session := app.Session{}
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

func writeBuild(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(100 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unable to parse multipart form: " + err.Error()})
		return
	}

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

	file, header, err := c.Request.FormFile("mapping_file")
	if err == nil {
		defer file.Close()

		if header != nil && header.Size > 0 {
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
		}	
	}
	

	buildType := c.Request.FormValue("build_type")
	buildSize, err := strconv.Atoi(c.Request.FormValue("build_size"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to parse build_size: " + err.Error()})
		return
	}

	filePath := filepath.Join(outputDir, appUniqueID, versionName, "build.toml")
	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed create build.toml file: " + err.Error()})
		return
	}

	defer out.Close()

	buildInfo := app.BuildInfo{
		Size: uint32(buildSize),
		Type: buildType,
	}

	if err := toml.NewEncoder(out).Encode(buildInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create build.toml file: " + err.Error()})
		return
	}

	c.Status(http.StatusAccepted)
}

# Running the Web Server with tmux

This guide explains how to run the web server in the background using `tmux`. `tmux` allows you to keep the server running even after you disconnect from the terminal.

## Starting the Server

To start the web server in a new detached `tmux` session named `webserver`, run the following command from the `project/veo-dashboard` directory:

```bash
tmux new-session -d -s webserver 'bun run start'
```

If you are in the root directory of the repository, you can use this command:

```bash
tmux new-session -d -s webserver 'cd project/veo-dashboard && bun run start'
```

### Command Breakdown:

-   `tmux new-session`: Starts a new `tmux` session.
-   `-d`: Detaches the session, running it in the background.
-   `-s webserver`: Names the session `webserver` for easy management.
-   `'...'`: The command to execute within the new session.

## Managing the `tmux` Session

Here are some useful commands to manage the `tmux` session.

### List Running Sessions

To see all active `tmux` sessions:

```bash
tmux ls
```

### Attach to the Session

To view the server logs or interact with the running process, attach to the session:

```bash
tmux attach -t webserver
```

Once attached, you can detach and leave the session running in the background by pressing `Ctrl+b` followed by `d`.

### Stop the Server

To stop the web server, you need to kill the `tmux` session:

```bash
tmux kill-session -t webserver
``` 
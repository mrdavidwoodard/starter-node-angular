var cmd=require('node-cmd');
var path, node_ssh, ssh, fs
fs = require('fs')
path = require('path')
node_ssh = require('node-ssh')
ssh= new node_ssh()

function main() {
    console.log("Deployment started.");
    cloneRepo();
}

//cloning repo from github
function cloneRepo() {
    console.log("Cloning repo...");
    //deleting old copy then cloning fresh copy
    cmd.get(
        'rm -rf starter-node-angular && git clone https://github.com/mrdavidwoodard/starter-node-angular.git',
        function(err, data, stderr) {
            console.log("cloneRep callback\n\t err: " + err + "\n\t data: " + data + "\n\t stderr: " + stderr);
            if(err == null) {
                sshConnect();
            }
        }
    );
}

//transfer project to server
function transferProjectToRemote(failed, successful) {
    return ssh.putDirectory(__dirname + '/starter-node-angular', '/home/ubuntu/starter-node-angular-temp', {
        recursive: true,
        concurrency: 1,
        validate: function(itemPath) {
            const baseName = path.basename(itemPath)
            return baseName.substr(0,1) !== '.' &&
            baseName !== 'node_modules'
        },
        tick: function(localPath, remotePath, error) {
            if(error) {
                failed.push(localPath)
                console.log("failed.push: " + localPath)
            } else {
                successful.push(localPath)
                console.log("successful.push: " + localPath)
            }
        }
    })
}

//create temp folder on server
function createRemoteTempFolder() {
    return ssh.execCommand('rm -rf starter-node-angular-temp && mkdir starter-node-angular-temp', { cwd: '/home/ubuntu' })
}

//stopping mongodb and node service on server
function stopRemoteServices() {
    return ssh.execCommand('npm stop && sudo service mongodb stop', { cwd: '/home/ubuntu' })
}

//updating project on server
function updateRemoteApp() {
    return ssh.execCommand('cp -r starter-node-angular-temp/* starter-node-angular/ && rm -rf starter-node-angular-temp/*', { cwd: '/home/ubuntu' })
}


//restart mongodb and node service on server
function restartRemoteServices() {
    return ssh.execCommand('npm start && sudo service mongod start', { cwd: '/home/ubuntu' })
}

//connecting to server
function sshConnect() {
    console.log('Connecting to the server...');
    ssh.connect({
        host: '18.217.129.40',
        username: 'ubuntu',
        privateKey: __dirname + '/sna-key.pem.txt'
    }).then(function(result) {
        const failed = []
		const successful = []
		if(result.stdout){ console.log('STDOUT: ' + result.stdout); }
		if(result.stderr){
			console.log('STDERR: ' + result.stderr);
			return Promise.reject(result.stderr);
		}
		return transferProjectToRemote(failed, successful);
	})
	.then(function(status) {
		if (status) {
			return stopRemoteServices();
		} else {
			return Promise.reject(failed.join(', '));
		}
	})
	.then(function(status) {
		if (status) {
			return updateRemoteApp();
		} else {
			return Promise.reject(failed.join(', '));
		}
	})
	.then(function(status) {
		if (status) {
			return restartRemoteServices();
		} else {
			return Promise.reject(failed.join(', '));
		}
	})
	.then(function() {
		console.log("Deployment complete.");
		process.exit();
	})
	.catch(e => {
		console.error(e);
	})
}

main();
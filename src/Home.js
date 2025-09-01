import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Input from '@mui/material/Input';
import Button from '@mui/material/Button';
import GitHubIcon from '@mui/icons-material/GitHub';
import "./Home.css"

function Home() {
    const [url, setUrl] = useState('')

  const  handleChange = (e) => setUrl(e.target.value);

  const join = () => {
		if (url !== '') {
			let newUrl = url.split("/")
			window.location.href = `/${newUrl[url.length-1]}`
		} else {
			let otherUrl = Math.random().toString(36).substring(2, 7)
			window.location.href = `/${otherUrl}`
		}
	}


  return (
    <div className='home'>
      <div className="container2 ">
              <div className='githubCode' >
                  Source code: 
                  <IconButton className="githubIcon" onClick={() => window.location.href="https://github.com/####"}>
                      <GitHubIcon />
                  </IconButton>
            </div>
            <div className='right-wrapper'>
                  <h1 className="VideoMeeting">Video Meeting</h1>
                  <p className="conference">Zoom - Video conference website that lets you stay in touch with all your friends.</p>
              </div>
              <div className='startGit'>
                  <p className='innerStart'>Start or Join a Meeting</p>
                  <Input placeholder="URL" onChange={handleChange} />
                  <Button variant="contained" color="primary" onClick={join} className="go">Go</Button>
                </div>    
            </div>
           </div>
  )
}

export default Home
// @flow

import React, { Component } from 'react';
import { Button, Icon } from 'antd'
import { connect } from 'react-redux'
import * as actions from '../state/actions'
import isOnline from '../utils/isOnline'
// import ClearButton from './ClearButton'
import FileReaderInput from 'react-file-reader-input'
import { saveAs } from 'file-saver'
import generateExport from '../utils/generateExport'
import { notification } from 'antd';

var mapState = (state) => ({
  filename: state.filename || 'loading...',
  isUnsaved: state.isUnsaved,
  examples: state.examples,
})

const mapActions = dispatch => ({
  save: (examples) => {
    dispatch(actions.save(examples))
  },
  fetchData: (path, data) => {
    dispatch(actions.fetchData(path, data))
  },
  pushToRabbitJson: (examples) => {
    dispatch(actions.pushToRabbitJson(examples))
  },
})

const styles = {
  button: {
    height: 28,
    marginTop: 2,
    marginRight: 8,
  }
}
const openNotification = () => {
  const args = {
    message: 'Thông báo',
    description: 'Cập nhật thành công. ',
    duration: 2,
  };
  notification.open(args);


};



class TopBar extends Component {
  handleFileInputChange(_, results) {
    const [e, file] = results[0]
    let data
    try {
      data = JSON.parse(e.target.result)
    }
    catch (e) {
      return alert('Can\'t JSON parse the selected file :(')
    }
    data.rasa_nlu_data = data.rasa_nlu_data || {}
    data.rasa_nlu_data.common_examples = data.rasa_nlu_data.common_examples || []
    this.props.fetchData(file.name, data)
  }
  render() {
    const { filename, isUnsaved, save } = this.props

    const fileButtons = isOnline
      ? (
        <div style={{display: 'flex'}}>
          <FileReaderInput
            as='text'
            onChange={(e, results) => this.handleFileInputChange(e, results)}
            >
            <Button type='ghost' style={styles.button}>
              <Icon type='upload' /> Click to Upload
            </Button>
          </FileReaderInput>
          <Button
            type={isUnsaved ? 'primary' : 'ghost'}
            style={styles.button}
            onClick={() => {
              var blob = new Blob(
                [ generateExport() ],
                { type: 'text/plain;charset=utf-8' },
              )
              debugger
              saveAs(blob, filename)
            }}
          >
            <Icon type='download' /> Download
          </Button>

           

        </div>
      )
      : (
        <Button
          style={ styles.button }
          type={isUnsaved ? 'primary' : 'danger'}
          onClick={() => save(generateExport())}
        >
          Save
        </Button>
        
      )

    return (
      <div style={{ height: 32, display: 'flex' }}>
        <h1 style={{ marginLeft: 8, marginTop: 0, color:'green' }}>
          DỮ LIỆU ĐANG CHỜ TRAIN VÀ ĐÃ TRAIN XONG (STATUS=3)
        </h1>

        {isUnsaved ? openNotification() : null}


        <div style={{flex: 1}} />
          {/* <Button
          style={ styles.button }
          type='primary'
          onClick={() => openAddModal()}
        >
          Add new example
        </Button>  */}
        
         {fileButtons}
       
      </div>
    )
  }
}

export default connect(mapState, mapActions)(TopBar)
